from django.apps import AppConfig


class WorkflowConfig(AppConfig):
    name = "apps.workflow"
    label = "workflow"
    default_auto_field = "django.db.models.BigAutoField"

    def ready(self) -> None:
        from . import rules  # noqa: F401  (registers A-07)
