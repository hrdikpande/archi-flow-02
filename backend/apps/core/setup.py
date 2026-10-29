"""Organisation defaults, created idempotently (bootstrap, seeds, and upgrade migrations)."""

from typing import Any

from .defaults import DEFAULT_DISCIPLINES, DEFAULT_STAGE_TEMPLATE


def ensure_org_defaults(org: Any, apps: Any = None) -> None:
    """Settings, disciplines, the default stage template and automation rules.

    `apps` is the migration app registry when called from a data migration."""

    def model(label: str) -> Any:
        app_label, name = label.split(".")
        if apps is not None:
            return apps.get_model(app_label, name)
        from django.apps import apps as live

        return live.get_model(app_label, name)

    model("core.OrgSettings").objects.get_or_create(organisation=org)
    discipline = model("core.Discipline")
    if not discipline.objects.filter(organisation=org).exists():
        for order, (code, name, regex) in enumerate(DEFAULT_DISCIPLINES):
            discipline.objects.create(
                organisation=org, code=code, name=name, sheet_prefix_regex=regex, sort_order=order
            )
    template = model("projects.StageTemplate")
    if not template.objects.filter(organisation=org).exists():
        t = template.objects.create(
            organisation=org, name="Council of Architecture stages", is_default=True
        )
        item = model("projects.StageTemplateItem")
        for i, (name, pct) in enumerate(DEFAULT_STAGE_TEMPLATE):
            item.objects.create(template=t, seq=i + 1, name=name, fee_pct=pct)
    try:
        rule = model("automation.AutomationRule")
    except LookupError:
        return
    from apps.automation.defaults import DEFAULT_RULES

    for key, params in DEFAULT_RULES.items():
        rule.objects.get_or_create(organisation=org, key=key, defaults={"params": params})
