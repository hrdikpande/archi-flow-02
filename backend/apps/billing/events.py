"""A-09 runs on stage events; the billing signal notifies and pushes via outbox (02 §7)."""

from apps.accounts.models import User
from apps.accounts.roles import OrgRole, ProjectRole
from apps.core.formatting import inr
from apps.notifications.services import notify_many
from apps.outbox.models import OutboxEvent
from apps.outbox.registry import handles
from apps.projects.models import Stage, StageState
from apps.projects.people import members_with_role

from . import services
from .models import BillingSignal


@handles("stage.state_changed")
def a09_ready_to_invoice(event: OutboxEvent) -> None:
    if event.payload.get("to") != StageState.CLIENT_APPROVED:
        return
    stage = Stage.objects.filter(pk=event.payload["stage_id"]).first()
    if stage is not None:
        services.raise_signal(stage)


@handles("billing.ready")
def tell_accounts(event: OutboxEvent) -> None:
    """F-27: Accounts (and PL, Owner) get project, stage, fee % and amount."""
    signal = BillingSignal.objects.select_related("stage", "project").get(
        pk=event.payload["signal_id"]
    )
    audience = [
        *User.objects.filter(
            organisation_id=signal.organisation_id,
            is_active=True,
            org_role__in=[OrgRole.ACCOUNTS, OrgRole.OWNER],
        ),
        *members_with_role(signal.project_id, ProjectRole.PL),
    ]
    amount = f" · {inr(signal.fee_amount)}" if signal.fee_amount is not None else ""
    notify_many(
        audience,
        "ready_to_invoice",
        title=(
            f"Ready to invoice: {signal.project.code} {signal.stage.name} "
            f"({signal.fee_pct}% of fee{amount})"
        ),
        body=f"{signal.project.name}. Client approval and all deliverables are in.",
        link="/billing",
        dedupe_key=f"billing:{signal.pk}",
    )


@handles("billing.ready")
def push_webhook(event: OutboxEvent) -> None:
    signal = BillingSignal.objects.select_related("stage", "project").get(
        pk=event.payload["signal_id"]
    )
    if signal.webhook_delivered_at is None:
        services.deliver_webhook(signal)
