from django.apps import AppConfig


class CaConfig(AppConfig):
    name = "apps.ca"
    label = "ca"
    default_auto_field = "django.db.models.BigAutoField"

    def ready(self) -> None:
        from . import events, rules  # noqa: F401  (registers A-10)
