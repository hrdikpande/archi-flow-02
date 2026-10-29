"""Give organisations created before S2/S4 the default stage template and automation rules."""

from django.db import migrations


def forwards(apps, schema_editor):  # type: ignore[no-untyped-def]
    from apps.core.setup import ensure_org_defaults

    for org in apps.get_model("core", "Organisation").objects.all():
        ensure_org_defaults(org, apps)


class Migration(migrations.Migration):
    dependencies = [
        ("automation", "0001_initial"),
        ("projects", "0002_project_appointment_letter_project_cad_versions_and_more"),
        ("core", "0002_remove_orgsettings_thresholds"),
    ]
    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
