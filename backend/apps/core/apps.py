from django.apps import AppConfig


class CoreConfig(AppConfig):
    name = "apps.core"
    label = "core"
    default_auto_field = "django.db.models.BigAutoField"

    def ready(self) -> None:
        from . import checks, metrics  # noqa: F401

        metrics.register()
