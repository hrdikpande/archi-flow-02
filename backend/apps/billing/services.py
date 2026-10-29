"""A-09 and the billing signal (F-27, F-28, I-08)."""

import csv
import hashlib
import hmac
import io
import json
from datetime import datetime
from decimal import Decimal
from typing import Any
from zoneinfo import ZoneInfo

from django.db import transaction
from django.db.models import QuerySet
from django.utils import timezone

from apps.accounts.models import User
from apps.accounts.permissions import Action, require
from apps.accounts.roles import OrgRole, ProjectRole
from apps.audit.services import record
from apps.core import net
from apps.core.exceptions import ConflictError
from apps.core.models import BILLING_FIELDS, OrgSettings
from apps.outbox.services import emit
from apps.projects.models import ProjectMembership, Stage, StageState

from .models import BillingSignal


@transaction.atomic
def raise_signal(stage: Stage) -> BillingSignal | None:
    """A-09: deliverables issued AND client approval recorded → ready_to_invoice + signal."""
    from apps.projects.services import system_transition_stage

    if system_transition_stage(stage, "ready_to_invoice") is None:
        return None
    stage.refresh_from_db()
    signal, created = BillingSignal.objects.get_or_create(
        stage=stage,
        defaults={
            "organisation_id": stage.organisation_id,
            "project_id": stage.project_id,
            "fee_pct": stage.fee_pct,
            "fee_amount": stage.fee_amount,
            "ready_at": timezone.now(),
        },
    )
    if created:
        emit(
            "billing.ready",
            {
                "signal_id": str(signal.pk),
                "stage_id": str(stage.pk),
                "project_id": str(stage.project_id),
            },
            organisation_id=stage.organisation_id,
        )
    return signal


def visible_signals(user: User) -> QuerySet[BillingSignal]:
    require(user, Action.VIEW_BILLING)
    qs = BillingSignal.objects.filter(organisation_id=user.org_pk).select_related(
        "project__client", "stage", "invoiced_by"
    )
    if user.org_role in (OrgRole.OWNER, OrgRole.ACCOUNTS):
        return qs
    led = ProjectMembership.objects.filter(user=user, role=ProjectRole.PL).values("project_id")
    return qs.filter(project_id__in=led)


def days_waiting(signal: BillingSignal, now: datetime | None = None) -> int:
    end = signal.invoiced_at or now or timezone.now()
    return (end - signal.ready_at).days


@transaction.atomic
def mark_invoiced(actor: User, signal: BillingSignal, invoice_ref: str = "") -> BillingSignal:
    from apps.projects.services import system_transition_stage

    require(actor, Action.MARK_INVOICED)
    signal = (
        BillingSignal.objects.select_for_update(of=("self",))
        .select_related("stage")
        .get(pk=signal.pk)
    )
    if signal.invoiced_at:
        raise ConflictError("already_invoiced", f"{signal.stage} is already marked invoiced.")
    if signal.stage.state != StageState.READY_TO_INVOICE:
        raise ConflictError("not_ready", f"{signal.stage} is not ready to invoice.")
    system_transition_stage(signal.stage, "invoiced")
    signal.invoiced_at, signal.invoiced_by, signal.invoice_ref = (
        timezone.now(),
        actor,
        invoice_ref[:100],
    )
    signal.save()
    record(
        organisation_id=signal.organisation_id,
        actor=actor,
        verb="billing.invoiced",
        entity_type="billing.billingsignal",
        entity_id=signal.pk,
        entity_label=str(signal.stage),
        after={"invoice_ref": signal.invoice_ref},
        project_id=signal.project_id,
    )
    return signal


def _row(signal: BillingSignal, tz: ZoneInfo) -> dict[str, Any]:
    approval = signal.stage.approvals.order_by("-approved_on").first()
    return {
        "project_code": signal.project.code,
        "project_name": signal.project.name,
        "client": signal.project.client.name if signal.project.client else "",
        "stage": f"{signal.stage.seq}. {signal.stage.name}",
        "fee_pct": signal.fee_pct,
        "fee_amount": signal.fee_amount if signal.fee_amount is not None else "",
        "ready_date": signal.ready_at.astimezone(tz).strftime("%d-%b-%Y"),
        "days_waiting": days_waiting(signal),
        "approved_by": approval.approved_by if approval else "",
        "approved_on": approval.approved_on.strftime("%d-%b-%Y") if approval else "",
    }


def _safe(value: Any) -> Any:
    text = str(value)
    return f"'{text}" if len(text) > 1 and text[0] in "=+-@\t\r" else value


def export_csv(user: User) -> bytes:
    """F-28: ready (not yet invoiced) stages in the firm's agreed column layout."""
    settings_ = OrgSettings.objects.get(organisation_id=user.org_pk)
    tz = ZoneInfo(user.org.timezone)
    columns = [c for c in settings_.billing_csv_columns if c.get("field") in BILLING_FIELDS]
    signals = list(visible_signals(user).filter(invoiced_at__isnull=True))
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow([c.get("header") or BILLING_FIELDS[c["field"]] for c in columns])
    for s in signals:
        row = _row(s, tz)
        writer.writerow([_safe(row[c["field"]]) for c in columns])
    BillingSignal.objects.filter(pk__in=[s.pk for s in signals], exported_at__isnull=True).update(
        exported_at=timezone.now()
    )
    return ("﻿" + out.getvalue()).encode()  # BOM: Excel opens UTF-8 (₹) correctly


def webhook_payload(signal: BillingSignal) -> dict[str, Any]:
    return {
        "event": "stage.ready_to_invoice",
        "id": str(signal.pk),
        "project": {
            "id": str(signal.project_id),
            "code": signal.project.code,
            "name": signal.project.name,
        },
        "stage": {"id": str(signal.stage_id), "seq": signal.stage.seq, "name": signal.stage.name},
        "fee_pct": str(signal.fee_pct),
        "fee_amount": str(signal.fee_amount) if signal.fee_amount is not None else None,
        "ready_at": signal.ready_at.isoformat(),
        "mark_invoiced_url": f"/api/v1/billing/signals/{signal.pk}/invoiced",
    }


def deliver_webhook(signal: BillingSignal) -> bool:
    """I-08: POST signed JSON. Raises on failure so the outbox retries (02 §7)."""
    settings_ = OrgSettings.objects.get(organisation_id=signal.organisation_id)
    if not settings_.billing_webhook_url:
        return False
    body = json.dumps(webhook_payload(signal), default=str).encode()
    signature = hmac.new(
        settings_.billing_webhook_secret.encode(), body, hashlib.sha256
    ).hexdigest()
    status = net.post(
        settings_.billing_webhook_url,
        body,
        {"Content-Type": "application/json", "X-DrawingOps-Signature": f"sha256={signature}"},
    )
    if status >= 300:
        raise RuntimeError(f"billing webhook returned {status}")
    BillingSignal.objects.filter(pk=signal.pk).update(webhook_delivered_at=timezone.now())
    return True


def totals(signals: QuerySet[BillingSignal]) -> dict[str, Any]:
    ready = list(signals.filter(invoiced_at__isnull=True))
    amount = sum((s.fee_amount for s in ready if s.fee_amount is not None), Decimal(0))
    return {
        "stages": len(ready),
        "amount": amount,
        "oldest_days": max((days_waiting(s) for s in ready), default=None),
    }
