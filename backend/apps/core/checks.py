from typing import Any

from django.core.checks import Error, register


@register()
def email_is_safe(app_configs: Any, **kwargs: Any) -> list[Error]:
    from apps.notifications.email import email_target_problem

    problem = email_target_problem()
    return [Error(problem, id="drawingops.E001")] if problem else []
