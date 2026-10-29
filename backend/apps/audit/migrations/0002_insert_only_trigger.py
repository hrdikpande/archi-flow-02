"""F-39: audit rows cannot be edited or deleted, even by raw SQL from the app.

In production also grant the app's database role only INSERT and SELECT on audit_event
(docs/06 R-20); this trigger is the in-database guard that works in every environment.
"""

from django.db import migrations

FORWARD = """
CREATE OR REPLACE FUNCTION audit_event_block_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'audit_event is insert-only (% blocked)', TG_OP
        USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_event_insert_only
    BEFORE UPDATE OR DELETE ON audit_event
    FOR EACH ROW EXECUTE FUNCTION audit_event_block_mutation();
"""

REVERSE = """
DROP TRIGGER IF EXISTS audit_event_insert_only ON audit_event;
DROP FUNCTION IF EXISTS audit_event_block_mutation();
"""


class Migration(migrations.Migration):
    dependencies = [("audit", "0001_initial")]
    operations = [migrations.RunSQL(FORWARD, REVERSE)]
