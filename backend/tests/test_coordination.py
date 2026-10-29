"""F-34 / I-07: BCF 2.1/3.0 and Navisworks clash import; re-import updates, never duplicates."""

import io
import zipfile

import pytest

from apps.accounts.permissions import PermissionDeniedError
from apps.coordination import services
from apps.coordination.models import ClashIssue, ClashStatus
from apps.core.exceptions import DomainError
from apps.files.models import UploadKind

from .workflow_fixtures import ready_upload_for

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64

MARKUP_21 = """<?xml version="1.0" encoding="UTF-8"?>
<Markup>
  <Topic Guid="{guid}" TopicType="Clash" TopicStatus="{status}">
    <Title>{title}</Title>
    <Priority>High</Priority>
    <Labels>HVAC</Labels>
    <AssignedTo>mep@contractor.example</AssignedTo>
    <ModifiedDate>2026-10-20T10:00:00Z</ModifiedDate>
    <Description>Duct hits beam at C/4</Description>
  </Topic>
  <Viewpoints Guid="v1">
    <Viewpoint>viewpoint.bcfv</Viewpoint><Snapshot>snapshot.png</Snapshot>
  </Viewpoints>
</Markup>"""

MARKUP_30 = """<?xml version="1.0" encoding="UTF-8"?>
<Markup>
  <Topic Guid="t-30" TopicType="Issue" TopicStatus="Active">
    <Title>Cable tray v sprinkler main</Title>
    <Viewpoints>
      <ViewPoint Guid="v"><Viewpoint>v.bcfv</Viewpoint><Snapshot>shot.png</Snapshot></ViewPoint>
    </Viewpoints>
  </Topic>
</Markup>"""

NAVIS = """<?xml version="1.0" encoding="UTF-8"?>
<exchange><batchtest name="Coordination"><clashtests>
  <clashtest name="Mech v Struct"><clashresults>
    <clashresult name="Clash1" guid="n-1" status="new"><description>Hard</description></clashresult>
    <clashresult name="Clash2" guid="n-2" status="approved">
      <description>Hard</description>
    </clashresult>
  </clashresults></clashtest>
</clashtests></batchtest></exchange>"""


def bcf(*topics: tuple[str, str]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("bcf.version", '<Version VersionId="2.1"/>')
        for folder, markup in topics:
            zf.writestr(f"{folder}/markup.bcf", markup)
            zf.writestr(f"{folder}/snapshot.png", PNG)
            zf.writestr(f"{folder}/shot.png", PNG)
    return buf.getvalue()


def upload(user, fake_storage, data: bytes, name: str, sha: str):
    u = ready_upload_for(user, name, sha=sha, kind=UploadKind.DATA)
    fake_storage.objects[u.file.storage_key] = data
    return u


def test_bcf_import_then_reimport_updates(team, fake_storage):
    m = MARKUP_21.format(guid="t-1", status="Open", title="HVAC duct v beam")
    job = services.import_clashes(
        team.dl,
        team.project,
        upload(team.dl, fake_storage, bcf(("t-1", m), ("t-30", MARKUP_30)), "c.bcfzip", "b1").pk,
    )
    assert job.counts == {"topics": 2, "created": 2, "updated": 0}
    first = ClashIssue.objects.get(guid="t-1")
    assert first.priority == "High" and first.labels == ["HVAC"] and first.snapshot is not None
    assert first.assigned_to_text == "mep@contractor.example"
    assert ClashIssue.objects.get(guid="t-30").status == ClashStatus.IN_PROGRESS  # "Active"
    # Someone resolves it here; the next import keeps that decision but refreshes the title.
    services.update_issue(team.dl, first, status=ClashStatus.RESOLVED)
    m2 = MARKUP_21.format(guid="t-1", status="Open", title="HVAC duct v beam (rev)")
    job2 = services.import_clashes(
        team.dl, team.project, upload(team.dl, fake_storage, bcf(("t-1", m2)), "c2.bcfzip", "b2").pk
    )
    assert job2.counts == {"topics": 1, "created": 0, "updated": 1}
    first.refresh_from_db()
    assert first.title == "HVAC duct v beam (rev)" and first.status == ClashStatus.RESOLVED
    assert ClashIssue.objects.count() == 2


def test_navisworks_report(team, fake_storage):
    job = services.import_clashes(
        team.pl, team.project, upload(team.pl, fake_storage, NAVIS.encode(), "clash.xml", "n1").pk
    )
    assert job.counts["created"] == 2
    assert ClashIssue.objects.get(guid="n-2").status == ClashStatus.RESOLVED


def test_hostile_files_are_rejected(team, fake_storage):
    billion = """<?xml version="1.0"?>
<!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;">]>
<exchange>&lol2;</exchange>"""
    with pytest.raises(DomainError):
        services.import_clashes(
            team.pl, team.project, upload(team.pl, fake_storage, billion.encode(), "x.xml", "e1").pk
        )
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("../evil/markup.bcf", MARKUP_30)
    with pytest.raises(DomainError):
        services.import_clashes(
            team.pl,
            team.project,
            upload(team.pl, fake_storage, buf.getvalue(), "e.bcfzip", "e2").pk,
        )
    with pytest.raises(PermissionDeniedError):
        services.import_clashes(
            team.designer,
            team.project,
            upload(team.designer, fake_storage, NAVIS.encode(), "d.xml", "d1").pk,
        )


def test_api_list_and_update(team, client_for, fake_storage):
    services.import_clashes(
        team.pl, team.project, upload(team.pl, fake_storage, NAVIS.encode(), "c.xml", "a1").pk
    )
    rows = client_for(team.designer).get(f"/api/v1/projects/{team.project.pk}/clashes").json()
    assert len(rows) == 2
    from .workflow_fixtures import new_sheet

    sheet = new_sheet(team, "M-205")
    res = client_for(team.dl).patch(
        f"/api/v1/clashes/{rows[0]['id']}",
        {"status": "closed", "sheets": [str(sheet.pk)], "assignee": str(team.designer.pk)},
        format="json",
    )
    assert res.status_code == 200 and res.json()["sheet_refs"][0]["number"] == "M-205"
    assert (
        client_for(team.designer)
        .patch(f"/api/v1/clashes/{rows[0]['id']}", {"status": "open"}, format="json")
        .status_code
        == 403
    )
