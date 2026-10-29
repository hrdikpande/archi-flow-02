"""P3 construction administration: RFIs + A-10 (F-30), submittals with stamps (F-31), site reports
with photos (F-32), change orders (F-33)."""

import io
from datetime import date, datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

import pypdfium2 as pdfium
import pytest
import time_machine
from PIL import Image

from apps.accounts.permissions import PermissionDeniedError
from apps.automation.engine import run_rule
from apps.automation.models import Flag
from apps.ca import services
from apps.ca.common import MAX_PHOTO_BYTES, compress_image
from apps.ca.models import ChangeStatus, Party, ReportState, RfiStatus, SubmittalStatus
from apps.core.exceptions import ConflictError, DomainError
from apps.files.models import UploadKind
from apps.notifications.models import Notification
from apps.register.models import SheetState

from .conftest import make_pdf
from .workflow_fixtures import draft_with_pdf, new_sheet, ready_upload_for

IST = ZoneInfo("Asia/Kolkata")


def issued_sheet(team, number="A-101"):
    sheet = new_sheet(team, number, state=SheetState.ISSUED)
    rev = draft_with_pdf(team, sheet, "C01")
    rev.state = "issued"
    rev.save()
    sheet.current_revision = rev
    sheet.save()
    return sheet


def pdf_upload(user, fake_storage, name="sub.pdf", sha="s1"):
    upload = ready_upload_for(user, name, sha=sha, kind=UploadKind.DOCUMENT)
    fake_storage.objects[upload.file.storage_key] = make_pdf(2)
    return upload


def photo_upload(user, fake_storage, size=(4000, 3000), sha="p1"):
    upload = ready_upload_for(user, "site.jpg", sha=sha, kind=UploadKind.IMAGE)
    buf = io.BytesIO()
    noise = Image.effect_noise(size, 90).convert("RGB")  # noisy: compresses badly
    exif = Image.Exif()
    exif[0x8825] = {2: (12, 58, 1)}  # GPS IFD
    noise.save(buf, "JPEG", quality=98, exif=exif)
    fake_storage.objects[upload.file.storage_key] = buf.getvalue()
    return upload


class TestRfi:
    def make(self, team, **kw):
        data = {
            "subject": "Slab level at grid C/4",
            "question": "Confirm FFL +450?",
            "received_on": date(2026, 10, 26),
            "due_on": date(2026, 10, 30),
            "assignee": team.dl,
        }
        data.update(kw)
        return services.create_rfi(team.dc, team.project, **data)

    def test_numbering_ball_in_court_and_permissions(self, team):
        first, second = self.make(team), self.make(team)
        assert (first.number, second.number) == ("2026-014-RFI-0001", "2026-014-RFI-0002")
        assert first.ball_in_court == Party.FIRM
        with pytest.raises(PermissionDeniedError):
            services.create_rfi(
                team.designer,
                team.project,
                subject="x",
                question="y",
                received_on=date(2026, 10, 26),
                due_on=date(2026, 10, 30),
            )
        with pytest.raises(DomainError):
            self.make(team, due_on=date(2026, 10, 1))

    def test_answer_starts_next_revision_and_close(self, team):
        sheet = issued_sheet(team)
        rfi = self.make(team, sheets=[sheet])
        result = services.respond_rfi(team.dl, rfi, "FFL is +450; revise section.", [sheet])
        sheet.refresh_from_db()
        assert result["revisions_started"] == ["A-101"] and sheet.state == SheetState.IN_PROGRESS
        rfi.refresh_from_db()
        assert rfi.status == RfiStatus.ANSWERED and rfi.ball_in_court == Party.CONTRACTOR
        closed = services.close_rfi(team.pl, rfi)
        assert closed.status == RfiStatus.CLOSED
        with pytest.raises(ConflictError):
            services.respond_rfi(team.dl, rfi, "again")

    def test_assignee_who_is_designer_may_answer(self, team):
        rfi = self.make(team, assignee=team.designer)
        services.respond_rfi(team.designer, rfi, "Done")
        other = self.make(team)
        with pytest.raises(PermissionDeniedError):
            services.respond_rfi(team.designer, other, "Not mine")

    def test_void_needs_reason(self, team):
        rfi = self.make(team)
        with pytest.raises(DomainError):
            services.close_rfi(team.pl, rfi, void=True)
        assert (
            services.close_rfi(team.pl, rfi, void=True, reason="Duplicate").status == RfiStatus.VOID
        )

    def test_a10_reminds_within_two_working_days(self, team):
        rfi = self.make(team, due_on=date(2026, 10, 29))  # Thursday
        with time_machine.travel(datetime(2026, 10, 26, 8, 5, tzinfo=IST), tick=False):  # Monday
            run_rule(team.org, "A-10")
            assert not Flag.objects.filter(kind="rfi_due").exists()  # 3 working days
        with time_machine.travel(datetime(2026, 10, 27, 8, 5, tzinfo=IST), tick=False):
            run_rule(team.org, "A-10")
            run_rule(team.org, "A-10")
            flag = Flag.objects.get(kind="rfi_due", cleared_at__isnull=True)
            assert flag.data["days"] == 2
            assert Notification.objects.filter(event="rfi_due", user=team.dl).count() == 1
            services.respond_rfi(team.dl, rfi, "Answered")
            run_rule(team.org, "A-10")
            flag.refresh_from_db()
            assert flag.cleared_at is not None


class TestSubmittal:
    def make(self, team, fake_storage):
        return services.create_submittal(
            team.dc,
            team.project,
            title="Fire damper shop drawings",
            kind="shop_drawing",
            received_on=date(2026, 10, 26),
            file_upload=pdf_upload(team.dc, fake_storage).pk,
            reviewer=team.dl,
        )

    def test_review_stamps_pdf_and_round_trip(self, team, fake_storage):
        sub = self.make(team, fake_storage)
        assert services.ball_in_court(sub) == Party.FIRM
        with pytest.raises(PermissionDeniedError):
            services.review_submittal(team.dc, sub, status="approved")
        with pytest.raises(DomainError):
            services.review_submittal(team.dl, sub, status="revise_resubmit")  # comment required
        sub = services.review_submittal(
            team.dl, sub, status="revise_resubmit", comment="Add access panels"
        )
        assert services.ball_in_court(sub) == Party.CONTRACTOR
        stamped = fake_storage.objects[sub.stamped_file.storage_key]
        pdf = pdfium.PdfDocument(stamped)
        text = pdf[0].get_textpage().get_text_range()
        assert "REVISE AND RESUBMIT" in text and sub.number in text and len(pdf) == 2
        assert fake_storage.objects[sub.file.storage_key] != stamped  # original kept
        sub = services.resubmit(team.dc, sub, pdf_upload(team.dc, fake_storage, "r2.pdf", "s2").pk)
        assert (sub.round, sub.status, sub.stamped_file) == (2, SubmittalStatus.PENDING, None)
        sub = services.review_submittal(team.senior, sub, status="approved")
        assert services.ball_in_court(sub) == ""
        with pytest.raises(ConflictError):
            services.resubmit(team.dc, sub, pdf_upload(team.dc, fake_storage, "r3.pdf", "s3").pk)

    def test_reviewer_must_be_able_to_review(self, team, fake_storage):
        with pytest.raises(DomainError):
            services.create_submittal(
                team.dc,
                team.project,
                title="x",
                kind="sample",
                received_on=date(2026, 10, 26),
                file_upload=pdf_upload(team.dc, fake_storage).pk,
                reviewer=team.designer,
            )


class TestSiteReport:
    def test_photo_is_compressed_and_stripped(self, fake_storage):
        buf = io.BytesIO()
        image = Image.effect_noise((4000, 3000), 90).convert("RGB")
        exif = Image.Exif()
        exif[0x0110] = "PhoneModel"
        image.save(buf, "JPEG", quality=98, exif=exif)
        assert buf.tell() > MAX_PHOTO_BYTES
        out = compress_image(buf.getvalue())
        assert len(out) <= MAX_PHOTO_BYTES
        assert not Image.open(io.BytesIO(out)).getexif()

    def test_designer_files_report_with_photos_to_pdf(self, team, fake_storage):
        sheet = new_sheet(team, "A-101")
        report = services.create_report(
            team.designer,
            team.project,
            visit_date=date(2026, 10, 26),
            attendees="PL, contractor PM",
            weather="Sunny",
        )
        with pytest.raises(DomainError):
            services.file_report(team.designer, report)  # empty
        obs = services.add_observation(
            team.designer,
            report,
            text="Duct clashes with beam at C/4.",
            sheet=sheet,
            action="Contractor to reroute",
            action_owner="contractor",
            photo_ids=[photo_upload(team.designer, fake_storage).pk],
        )
        photo = obs.photos.get()
        assert photo.mime == "image/jpeg" and photo.size <= MAX_PHOTO_BYTES
        report = services.file_report(team.designer, report)
        assert report.state == ReportState.FILED
        text = (
            pdfium.PdfDocument(fake_storage.objects[report.pdf.storage_key])[0]
            .get_textpage()
            .get_text_range()
        )
        assert report.number in text and "Duct clashes" in text and "A-101" in text
        with pytest.raises(ConflictError):
            services.add_observation(team.designer, report, text="late")
        with pytest.raises(PermissionDeniedError):
            services.create_report(team.outsider, team.project, visit_date=date(2026, 10, 26))


class TestChangeOrder:
    def test_decide_and_start_revision_cycle(self, team):
        sheet = issued_sheet(team)
        rfi = services.create_rfi(
            team.dc,
            team.project,
            subject="Add sink",
            question="Where?",
            received_on=date(2026, 10, 26),
            due_on=date(2026, 10, 30),
        )
        co = services.create_change_order(
            team.dc,
            team.project,
            title="Add scrub sink",
            description="Client asked",
            origin="rfi",
            rfi=rfi,
            cost_impact=Decimal("85000"),
            schedule_impact_days=3,
            sheets=[sheet],
        )
        assert co.number == "2026-014-CO-0001"
        with pytest.raises(ConflictError):
            services.start_revision_cycle(team.dc, co)  # not approved yet
        with pytest.raises(PermissionDeniedError):
            services.decide_change_order(team.dl, co, True)
        with pytest.raises(DomainError):
            services.decide_change_order(team.pl, co, False)  # reason needed
        co = services.decide_change_order(team.pl, co, True, "Approved by client email")
        result = services.start_revision_cycle(team.pl, co)
        sheet.refresh_from_db()
        assert result["revisions_started"] == ["A-101"] and sheet.state == SheetState.IN_PROGRESS
        co.refresh_from_db()
        assert co.status == ChangeStatus.IMPLEMENTED and co.revision_cycle_started


class TestApi:
    def test_rfi_flow_over_http(self, team, client_for):
        dc = client_for(team.dc)
        res = dc.post(
            f"/api/v1/projects/{team.project.pk}/rfis",
            {
                "subject": "Lintel",
                "question": "Size?",
                "received_on": "2026-10-26",
                "due_on": "2026-10-30",
                "assignee": str(team.dl.pk),
            },
            format="json",
        )
        assert res.status_code == 201, res.content
        rid = res.json()["id"]
        res = client_for(team.dl).post(
            f"/api/v1/rfis/{rid}/respond", {"response": "200 deep"}, format="json"
        )
        assert res.status_code == 200 and res.json() == {"revisions_started": [], "skipped": []}
        listed = client_for(team.designer).get(f"/api/v1/projects/{team.project.pk}/rfis").json()
        assert listed[0]["status"] == "answered" and listed[0]["ball_in_court"] == "contractor"
        assert client_for(team.outsider).get(f"/api/v1/rfis/{rid}").status_code == 404
