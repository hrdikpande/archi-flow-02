"""F-44 (02 §10): full-text vectors kept by triggers, GIN indexes, trigram index on numbers.

The 'simple' configuration is used on purpose: sheet numbers, codes and names must not be
stemmed or dropped as stop words ("A-101", "OT", "PHE").
"""

from django.contrib.postgres.operations import TrigramExtension
from django.db import migrations

TABLES = {
    "sheet": """
        setweight(to_tsvector('simple', coalesce(NEW.number, '')), 'A') ||
        setweight(to_tsvector('simple', array_to_string(coalesce(NEW.aliases, '{}'), ' ')), 'A') ||
        setweight(to_tsvector('simple', coalesce(NEW.title, '')), 'B')
    """,
    "project": """
        setweight(to_tsvector('simple', coalesce(NEW.code, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(NEW.name, '')), 'B') ||
        setweight(to_tsvector('simple', coalesce(NEW.location, '')), 'C')
    """,
    "transmittal": """
        setweight(to_tsvector('simple', coalesce(NEW.number, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(NEW.purpose, '')), 'C')
    """,
    "contact": """
        setweight(to_tsvector('simple', coalesce(NEW.full_name, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(NEW.email, '')), 'B') ||
        setweight(to_tsvector('simple', coalesce(
            (SELECT o.name FROM external_org o WHERE o.id = NEW.external_org_id), '')), 'C')
    """,
}


# Only edits to searched columns recompute the vector (sheet state changes are frequent).
COLUMNS = {
    "sheet": ["number", "title", "aliases"],
    "project": ["code", "name", "location"],
    "transmittal": ["number", "purpose"],
    "contact": ["full_name", "email", "external_org_id"],
}


def forward_sql() -> str:
    parts = []
    for table, expr in TABLES.items():
        cols = ", ".join(COLUMNS[table])
        first = COLUMNS[table][0]
        parts.append(f"""
CREATE OR REPLACE FUNCTION {table}_search_vector() RETURNS trigger AS $$
BEGIN
    NEW.search_vector := {expr};
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER {table}_search_vector_trg BEFORE INSERT OR UPDATE OF {cols} ON {table}
    FOR EACH ROW EXECUTE FUNCTION {table}_search_vector();
UPDATE {table} SET {first} = {first};
CREATE INDEX {table}_search_gin ON {table} USING gin (search_vector);
""")
    parts.append("CREATE INDEX sheet_number_trgm ON sheet USING gin (number gin_trgm_ops);")
    parts.append("CREATE INDEX project_code_trgm ON project USING gin (code gin_trgm_ops);")
    parts.append("CREATE INDEX transmittal_number_trgm ON transmittal USING gin (number gin_trgm_ops);")
    return "\n".join(parts)


def reverse_sql() -> str:
    parts = ["DROP INDEX IF EXISTS sheet_number_trgm, project_code_trgm, transmittal_number_trgm;"]
    for table in TABLES:
        parts.append(f"""
DROP INDEX IF EXISTS {table}_search_gin;
DROP TRIGGER IF EXISTS {table}_search_vector_trg ON {table};
DROP FUNCTION IF EXISTS {table}_search_vector();
""")
    return "\n".join(parts)


class Migration(migrations.Migration):
    dependencies = [
        ("register", "0004_search_vector"),
        ("projects", "0003_search_vector"),
        ("transmittals", "0002_search_vector"),
        ("contacts", "0002_search_vector"),
    ]
    operations = [TrigramExtension(), migrations.RunSQL(forward_sql(), reverse_sql())]
