from django.apps import AppConfig


class TransmittalsConfig(AppConfig):
    name = "apps.transmittals"
    label = "transmittals"
    default_auto_field = "django.db.models.BigAutoField"

    def ready(self) -> None:
        from . import events  # noqa: F401
