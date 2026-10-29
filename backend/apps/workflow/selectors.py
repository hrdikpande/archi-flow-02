"""Review queue (S-08; F-12 ageing): what is waiting for this user's check."""

from dataclasses import dataclass
from datetime import date
from typing import Any
from zoneinfo import ZoneInfo

from django.db.models import Q
from django.utils import timezone

from apps.accounts.models import User
from apps.accounts.roles import ProjectRole
from apps.core.calendar import WorkingCalendar
from apps.core.clock import org_today
from apps.projects.models import ProjectMembership
from apps.register.models import Sheet, SheetState

from .models import Review, ReviewKind, ReviewState


@dataclass
class QueueItem:
    sheet: Sheet
    review: Review | None
    kind: str  # "ready_for_check" | "check" | "senior_qc"
    waiting_since: Any
    working_days_waiting: int
    delegated_from: Any = None  # the reviewer this item is covering for (F-12)


def review_queue(user: User) -> list[QueueItem]:
    senior_projects = ProjectMembership.objects.filter(
        user=user, role=ProjectRole.SENIOR_REVIEWER
    ).values_list("project_id", flat=True)
    from .delegation import can_review_on, delegators_of

    away = delegators_of(user, org_today(user.org))  # F-12: reviews delegated to me
    waiting = Sheet.objects.filter(
        Q(checker=user) | Q(checker_id__in=away), state=SheetState.READY_FOR_CHECK
    ).select_related("project", "stage", "owner", "discipline", "checker")
    reviews = (
        Review.objects.filter(state=ReviewState.OPEN)
        .filter(
            Q(reviewer=user)
            | Q(reviewer_id__in=away, kind=ReviewKind.CHECK)
            | Q(
                kind=ReviewKind.SENIOR_QC,
                reviewer__isnull=True,
                sheet__project_id__in=senior_projects,
            )
        )
        .select_related(
            "sheet__project", "sheet__stage", "sheet__owner", "sheet__discipline", "reviewer"
        )
    )
    items = [
        QueueItem(
            s,
            None,
            "ready_for_check",
            s.state_changed_at or s.updated_at,
            0,
            s.checker if s.checker_id != user.pk else None,
        )
        for s in waiting
        if s.checker_id == user.pk or can_review_on(user, s.project_id)
    ] + [
        QueueItem(
            r.sheet,
            r,
            r.kind,
            r.opened_at,
            0,
            r.reviewer if r.reviewer_id not in (None, user.pk) else None,
        )
        for r in reviews
        if r.sheet.state == SheetState.IN_CHECK
        and (r.reviewer_id in (None, user.pk) or can_review_on(user, r.sheet.project_id))
    ]
    if not items:
        return []
    org = user.org
    calendar = WorkingCalendar.for_org(org)
    today: date = org_today(org)
    for item in items:
        since = timezone.localtime(item.waiting_since, ZoneInfo(org.timezone)).date()
        item.working_days_waiting = max(0, calendar.working_days_between(since, today))
    return sorted(items, key=lambda i: i.waiting_since)
