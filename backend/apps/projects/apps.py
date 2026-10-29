from django.apps import AppConfig


class ProjectsConfig(AppConfig):
    name = "apps.projects"
    label = "projects"
    default_auto_field = "django.db.models.BigAutoField"

    def ready(self) -> None:
        from . import events  # noqa: F401
