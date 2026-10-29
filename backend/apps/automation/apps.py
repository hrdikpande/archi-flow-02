from django.apps import AppConfig


class AutomationConfig(AppConfig):
    name = "apps.automation"
    label = "automation"
    default_auto_field = "django.db.models.BigAutoField"

    def ready(self) -> None:
        from . import events  # noqa: F401
