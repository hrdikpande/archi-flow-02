from django.apps import AppConfig


class DashboardsConfig(AppConfig):
    name = "apps.dashboards"
    label = "dashboards"
    default_auto_field = "django.db.models.BigAutoField"

    def ready(self) -> None:
        from . import events  # noqa: F401
