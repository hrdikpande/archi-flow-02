from django.apps import AppConfig


class CommentsConfig(AppConfig):
    name = "apps.comments"
    label = "comments"
    default_auto_field = "django.db.models.BigAutoField"

    def ready(self) -> None:
        from . import events, rules  # noqa: F401
