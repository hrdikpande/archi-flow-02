from django.db import models


class OrgRole(models.TextChoices):
    """One per user (03 §1)."""

    OWNER = "owner", "Owner / Principal"
    STAFF = "staff", "Staff"
    ACCOUNTS = "accounts", "Accounts"
    ADMIN = "admin", "System admin"


class ProjectRole(models.TextChoices):
    """One per user per project (03 §1)."""

    PL = "pl", "Project lead"
    DL = "dl", "Discipline lead"
    DESIGNER = "designer", "Designer"
    SENIOR_REVIEWER = "senior_reviewer", "Senior reviewer"
    DC = "dc", "Document controller"
    VIEWER = "viewer", "Viewer"
