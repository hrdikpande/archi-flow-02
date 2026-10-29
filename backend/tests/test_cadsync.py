"""S10 (P2): CAD sheet-list sync proposals F-09 (I-03/I-04) and storage connector I-02."""

import pytest

from apps.accounts.permissions import PermissionDeniedError
from apps.accounts.services import create_api_token
from apps.cadsync import services
from apps.cadsync.models import CadFileEvent, ProposalKind, ProposalState, SyncProposal
from apps.core.exceptions import ConflictError, DomainError
from apps.register.models import Sheet

from .workflow_fixtures import draft_with_pdf, new_sheet

SYNC = [
    {"number": "A-101", "title": "Ground Floor Plan", "revision": "P01"},
    {"number": "A-102", "title": "First Floor Plan (revised)", "revision": ""},
    {"number": "A-103", "title": "Second Floor Plan", "revision": "P01"},
]


class TestProposals:
    def setup_sheets(self, team):
        a101 = new_sheet(team, "A-101", title="Ground Floor Plan")
        rev = draft_with_pdf(team, a101, "P02")
        a101.current_revision = rev
        a101.save()
        new_sheet(team, "A-102", title="First Floor Plan")

    def test_sync_proposes_and_never_creates(self, team):
        self.setup_sheets(team)
        batch = services.receive_sync(
            team.designer, project_code="2026-014", source="revit", sheets=SYNC
        )
        assert batch.counts == {"matched": 0, "new": 1, "title": 1, "revision": 1}
        assert not Sheet.objects.filter(number="A-103").exists()
        kinds = {(p.number, p.kind) for p in SyncProposal.objects.all()}
        assert kinds == {
            ("A-101", ProposalKind.REVISION),
            ("A-102", ProposalKind.TITLE),
            ("A-103", ProposalKind.NEW),
        }
        title = SyncProposal.objects.get(kind=ProposalKind.TITLE)
        assert (title.register_title, title.cad_title) == (
            "First Floor Plan",
            "First Floor Plan (revised)",
        )
        assert (
            SyncProposal.objects.get(kind=ProposalKind.NEW).discipline == team.arch
        )  # from ^A-\d{3}$

    def test_dl_accepts_new_and_title(self, team):
        self.setup_sheets(team)
        services.receive_sync(team.designer, project_code="2026-014", source="autocad", sheets=SYNC)
        new = SyncProposal.objects.get(kind=ProposalKind.NEW)
        with pytest.raises(PermissionDeniedError):
            services.decide(team.designer, new, True, stage=team.stage)
        services.decide(team.dl, new, True, stage=team.stage)
        assert Sheet.objects.get(number="A-103").title == "Second Floor Plan"
        services.decide(team.dl, SyncProposal.objects.get(kind=ProposalKind.TITLE), True)
        assert Sheet.objects.get(number="A-102").title == "First Floor Plan (revised)"
        with pytest.raises(ConflictError):
            services.decide(team.dl, new, False)

    def test_newer_sync_supersedes_open_proposals(self, team):
        services.receive_sync(
            team.designer, project_code="2026-014", source="revit", sheets=SYNC[2:]
        )
        services.receive_sync(
            team.designer, project_code="2026-014", source="revit", sheets=SYNC[2:]
        )
        states = sorted(p.state for p in SyncProposal.objects.filter(number="A-103"))
        assert states == [ProposalState.OPEN, ProposalState.SUPERSEDED]

    def test_project_access(self, team):
        with pytest.raises(DomainError):
            services.receive_sync(
                team.designer, project_code="9999-999", source="revit", sheets=SYNC
            )
        with pytest.raises(PermissionDeniedError):
            services.receive_sync(
                team.outsider, project_code="2026-014", source="revit", sheets=SYNC
            )

    def test_plugin_uses_a_scoped_token(self, team, admin, client):
        _, cad = create_api_token(
            admin, user=team.designer, name="revit", scopes=["cad_sync:write"]
        )
        _, other = create_api_token(
            admin, user=team.designer, name="acc", scopes=["accounting:read"]
        )
        body = {
            "project_code": "2026-014",
            "source": "revit",
            "app_version": "Revit 2024",
            "sheets": SYNC,
        }
        url = "/api/v1/integrations/cad-sync"
        no_key = client.post(
            url, body, content_type="application/json", HTTP_AUTHORIZATION=f"Bearer {cad}"
        )
        assert no_key.status_code == 400 and no_key.json()["code"] == "idempotency_key_required"
        auth = {"HTTP_AUTHORIZATION": f"Bearer {cad}", "HTTP_IDEMPOTENCY_KEY": "sync-1"}
        ok = client.post(url, body, content_type="application/json", **auth)
        assert ok.status_code == 201 and ok.json()["counts"]["new"] == 3
        again = client.post(url, body, content_type="application/json", **auth)
        assert again["Idempotent-Replayed"] == "true" and again.json()["id"] == ok.json()["id"]
        from apps.cadsync.models import SyncBatch

        assert SyncBatch.objects.count() == 1  # the retry was not applied twice
        changed = client.post(
            url, {**body, "sheets": SYNC[:1]}, content_type="application/json", **auth
        )
        assert changed.status_code == 422
        denied = client.post(
            "/api/v1/integrations/cad-sync",
            body,
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {other}",
            HTTP_IDEMPOTENCY_KEY="x",
        )
        assert denied.status_code == 403


class TestFileEvents:
    def test_matches_by_cad_link_then_by_number(self, team, admin, client):
        a = new_sheet(team, "A-101", cad_link=r"\\fileserver\2026-014\ARCH\GF-PLAN.dwg")
        b = new_sheet(team, "A-102")
        _, token = create_api_token(
            admin, user=team.designer, name="watcher", scopes=["file_events:write"]
        )
        body = {
            "project_code": "2026-014",
            "connector": "folder-watcher",
            "events": [
                {
                    "path": r"\\FILESERVER\2026-014\ARCH\gf-plan.dwg",
                    "event": "modified",
                    "by": "rahul",
                },
                {"path": "/mnt/projects/2026-014/ARCH/A-102 First Floor.dwg", "event": "created"},
                {"path": "/mnt/projects/2026-014/ARCH/xref-site.dwg", "event": "modified"},
            ],
        }
        res = client.post(
            "/api/v1/integrations/file-events",
            body,
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
            HTTP_IDEMPOTENCY_KEY="ev-1",
        )
        assert res.status_code == 201, res.content
        assert res.json() == {"matched": 2, "unmatched": 1}
        assert CadFileEvent.objects.get(sheet=a).by == "rahul"
        assert CadFileEvent.objects.get(sheet=b).event == "created"
