from django.apps import AppConfig


class PeopleConfig(AppConfig):
    name = "apps.people"
    label = "people"
    default_auto_field = "django.db.models.BigAutoField"

    def ready(self) -> None:
        from . import events, rules  # noqa: F401
