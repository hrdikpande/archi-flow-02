from django.conf import settings
from django.contrib import admin
from django.http import HttpRequest, HttpResponseRedirect
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView
from rest_framework.routers import DefaultRouter

from apps.accounts.api.views import (
    ApiTokenViewSet,
    CsrfView,
    DirectoryView,
    MeView,
    UserViewSet,
)
from apps.audit.api.activity import ActivityView
from apps.audit.api.views import AuditEventViewSet
from apps.automation.api.views import AutomationRuleViewSet, AutomationRunViewSet
from apps.billing import api as billing_views
from apps.ca import api as ca_views
from apps.cadsync import api as cad_views
from apps.comments.api import views as comment_views
from apps.comments.webhook import inbound_email as inbound_email_webhook
from apps.contacts.api.views import ContactViewSet, ExternalOrgViewSet
from apps.coordination import api as clash_views
from apps.core.api.views import DisciplineViewSet, HolidayViewSet, OrgSettingsView
from apps.core.cron import cron_tick
from apps.core.health import healthz, livez
from apps.dashboards import api as dashboard_views
from apps.exports import api as export_views
from apps.files.api.views import UploadViewSet
from apps.intelligence import api as intel_views
from apps.knowledge import api as knowledge_views
from apps.notifications.api import views as notification_views
from apps.notifications.api.views import TestEmailView
from apps.people import api as people_views
from apps.projects.api import views as project_views
from apps.register.api import onboarding as onboarding_views
from apps.register.api import views as register_views
from apps.search.api import SearchView
from apps.transmittals import api as transmittal_views
from apps.transmittals import public as transmittal_public
from apps.transmittals import site as transmittal_site
from apps.transmittals import site_api as site_link_views
from apps.workflow.api import precheck as precheck_views
from apps.workflow.api import views as workflow_views


def _admin_login(request: HttpRequest, extra_context: object = None) -> HttpResponseRedirect:
    """Django admin uses the SPA sign-in, so password + TOTP always applies (F-40)."""
    return HttpResponseRedirect(f"{settings.FRONTEND_URL}/sign-in?next=/django-admin/")


admin.site.login = _admin_login  # type: ignore[method-assign]
admin.site.site_header = "DrawingOps support"

router = DefaultRouter(trailing_slash=False)
router.include_root_view = False
router.register("disciplines", DisciplineViewSet, basename="discipline")
router.register("holidays", HolidayViewSet, basename="holiday")
router.register("users", UserViewSet, basename="user")
router.register("api-tokens", ApiTokenViewSet, basename="api-token")
router.register("external-orgs", ExternalOrgViewSet, basename="external-org")
router.register("contacts", ContactViewSet, basename="contact")
router.register("audit", AuditEventViewSet, basename="audit")
router.register("uploads", UploadViewSet, basename="upload")
router.register("projects", project_views.ProjectViewSet, basename="project")
router.register("stage-templates", project_views.StageTemplateViewSet, basename="stage-template")
router.register("saved-views", register_views.SavedViewViewSet, basename="saved-view")
router.register("naming-rules", register_views.NamingRuleViewSet, basename="naming-rule")
router.register("automation-rules", AutomationRuleViewSet, basename="automation-rule")
router.register("automation-runs", AutomationRunViewSet, basename="automation-run")

api_v1 = [
    path("auth/csrf", CsrfView.as_view(), name="csrf"),
    path("me", MeView.as_view(), name="me"),
    path("org/settings", OrgSettingsView.as_view(), name="org-settings"),
    path("org/test-email", TestEmailView.as_view(), name="org-test-email"),
    path("directory", DirectoryView.as_view(), name="directory"),
    # Projects, stages, packages, team (S2)
    path("projects/<uuid:project_pk>/stages", project_views.StageListView.as_view()),
    path(
        "projects/<uuid:project_pk>/stages/apply-template",
        project_views.ApplyTemplateView.as_view(),
    ),
    path("stages/<uuid:pk>/transitions", project_views.StageTransitionView.as_view()),
    path(
        "projects/<uuid:project_pk>/appointment-letter",
        project_views.AppointmentLetterView.as_view(),
    ),
    path("projects/<uuid:project_pk>/packages", project_views.PackageListView.as_view()),
    path("packages/<uuid:pk>", project_views.PackageDetailView.as_view()),
    path("projects/<uuid:project_pk>/members", project_views.MemberListView.as_view()),
    path("members/<uuid:pk>", project_views.MemberDetailView.as_view()),
    # Register and imports (S2)
    path("projects/<uuid:project_pk>/sheets", register_views.SheetListView.as_view()),
    path("sheets/<uuid:pk>", register_views.SheetDetailView.as_view()),
    path("projects/<uuid:project_pk>/imports", register_views.ImportStartView.as_view()),
    path("imports/template", register_views.ImportTemplateView.as_view()),
    path("imports/<uuid:pk>", register_views.ImportJobView.as_view()),
    path("imports/<uuid:pk>/commit", register_views.ImportCommitView.as_view()),
    path("imports/<uuid:pk>/undo", register_views.ImportUndoView.as_view()),
    # Workflow, revisions, reviews (S3)
    path("projects/<uuid:project_pk>/sheets/bulk", register_views.SheetBulkView.as_view()),
    path("sheets/<uuid:pk>/detail", register_views.SheetFullView.as_view()),
    path("sheets/<uuid:pk>/revisions", register_views.RevisionListView.as_view()),
    path("sheets/<uuid:pk>/transitions", workflow_views.SheetTransitionView.as_view()),
    path("sheets/<uuid:pk>/timeline", workflow_views.SheetTimelineView.as_view()),
    path("sheets/<uuid:pk>/reviews", workflow_views.SheetReviewsView.as_view()),
    path("revisions/<uuid:pk>/download", register_views.RevisionDownloadView.as_view()),
    path("naming-rules/test", register_views.NamingTestView.as_view()),
    path("reviews", workflow_views.ReviewQueueView.as_view()),
    path("reviews/<uuid:pk>/approve", workflow_views.ReviewApproveView.as_view()),
    path("reviews/<uuid:pk>/return", workflow_views.ReviewReturnView.as_view()),
    path("reviews/<uuid:pk>/redlines", workflow_views.ReviewRedlinesView.as_view()),
    # Transmittals, notifications (S4)
    path(
        "projects/<uuid:project_pk>/transmittals", transmittal_views.TransmittalListView.as_view()
    ),
    path(
        "projects/<uuid:project_pk>/transmittals/preview",
        transmittal_views.TransmittalPreviewView.as_view(),
    ),
    path(
        "projects/<uuid:project_pk>/transmittals/cover-preview",
        transmittal_views.CoverPreviewView.as_view(),
    ),
    path("transmittals/<uuid:pk>", transmittal_views.TransmittalDetailView.as_view()),
    path("transmittals/<uuid:pk>/cover", transmittal_views.CoverView.as_view()),
    path("recipients/<uuid:pk>/resend", transmittal_views.ResendView.as_view()),
    path("sheets/<uuid:pk>/distribution", transmittal_views.DistributionView.as_view()),
    path("notifications", notification_views.NotificationListView.as_view()),
    path("notifications/read", notification_views.MarkReadView.as_view()),
    path("notification-preferences", notification_views.PreferencesView.as_view()),
    # S12-S14 construction administration (P3: F-30..F-33)
    path("projects/<uuid:project_pk>/rfis", ca_views.RfiListView.as_view()),
    path("rfis/<uuid:pk>", ca_views.RfiDetailView.as_view()),
    path("rfis/<uuid:pk>/respond", ca_views.RfiRespondView.as_view()),
    path("rfis/<uuid:pk>/close", ca_views.RfiCloseView.as_view()),
    path("projects/<uuid:project_pk>/submittals", ca_views.SubmittalListView.as_view()),
    path("submittals/<uuid:pk>", ca_views.SubmittalDetailView.as_view()),
    path("submittals/<uuid:pk>/review", ca_views.SubmittalReviewView.as_view()),
    path("submittals/<uuid:pk>/resubmit", ca_views.SubmittalResubmitView.as_view()),
    path("projects/<uuid:project_pk>/site-reports", ca_views.SiteReportListView.as_view()),
    path("site-reports/<uuid:pk>", ca_views.SiteReportDetailView.as_view()),
    path("site-reports/<uuid:pk>/observations", ca_views.ObservationAddView.as_view()),
    path("site-reports/<uuid:pk>/file", ca_views.SiteReportFileView.as_view()),
    path("observations/<uuid:pk>", ca_views.ObservationDeleteView.as_view()),
    path("projects/<uuid:project_pk>/change-orders", ca_views.ChangeOrderListView.as_view()),
    path("change-orders/<uuid:pk>", ca_views.ChangeOrderDetailView.as_view()),
    path("change-orders/<uuid:pk>/decide", ca_views.ChangeOrderDecideView.as_view()),
    path("change-orders/<uuid:pk>/start-revisions", ca_views.ChangeOrderRevisionsView.as_view()),
    # Phase 4 intelligence (F-55..F-57, after G3)
    path("intelligence/status", intel_views.StatusView.as_view()),
    path("intelligence/run", intel_views.RunNowView.as_view()),
    path("intelligence/workload", intel_views.WorkloadForecastView.as_view()),
    path("intelligence/findings", intel_views.FindingQueueView.as_view()),
    path("intelligence/findings/evaluation", intel_views.EvaluationView.as_view()),
    path("projects/<uuid:project_pk>/risk", intel_views.ProjectRiskView.as_view()),
    path("predictions/<uuid:pk>/feedback", intel_views.PredictionFeedbackView.as_view()),
    path("sheets/<uuid:pk>/findings", intel_views.SheetFindingsView.as_view()),
    path("findings/<uuid:pk>/review", intel_views.FindingReviewView.as_view()),
    # S16 knowledge base (F-58)
    path("projects/<uuid:project_pk>/decisions", knowledge_views.DecisionListView.as_view()),
    path("knowledge/search", knowledge_views.KnowledgeSearchView.as_view()),
    # S15 coordination: clash issues from BCF / Navisworks (F-34, I-07)
    path("projects/<uuid:project_pk>/clash-imports", clash_views.ClashImportView.as_view()),
    path("projects/<uuid:project_pk>/clashes", clash_views.ClashListView.as_view()),
    path("clashes/<uuid:pk>", clash_views.ClashDetailView.as_view()),
    # S11 title-block reading (F-50)
    path("projects/<uuid:project_pk>/title-blocks", onboarding_views.TitleBlockView.as_view()),
    # S10 CAD plugins (F-09, I-03, I-04) and storage connector (I-02)
    path("integrations/cad-sync", cad_views.CadSyncView.as_view()),
    path("integrations/file-events", cad_views.FileEventsView.as_view()),
    path("projects/<uuid:project_pk>/cad-proposals", cad_views.ProposalListView.as_view()),
    path("cad-proposals/<uuid:pk>/decide", cad_views.ProposalDecideView.as_view()),
    path("sheets/<uuid:pk>/cad-events", cad_views.SheetCadEventsView.as_view()),
    # S9 billing signal and site view
    path("billing/signals", billing_views.SignalListView.as_view()),
    path("billing/signals/export", billing_views.SignalExportView.as_view()),
    path("billing/signals/<uuid:pk>/invoiced", billing_views.MarkInvoicedView.as_view()),
    path("projects/<uuid:project_pk>/site-links", site_link_views.SiteLinkListView.as_view()),
    path("site-links/<uuid:pk>/revoke", site_link_views.SiteLinkRevokeView.as_view()),
    # S8 client comments, email capture, stage approvals
    path("projects/<uuid:project_pk>/comments", comment_views.CommentListView.as_view()),
    path("comments/<uuid:pk>", comment_views.CommentDetailView.as_view()),
    path("comments/<uuid:pk>/attachments", comment_views.CommentAttachmentsView.as_view()),
    path("projects/<uuid:project_pk>/inbound-emails", comment_views.InboundEmailListView.as_view()),
    path("inbound-emails/<uuid:pk>/review", comment_views.InboundEmailReviewView.as_view()),
    path("projects/<uuid:project_pk>/approvals", comment_views.ApprovalListView.as_view()),
    path("stages/<uuid:pk>/approval", comment_views.StageApprovalView.as_view()),
    # S7 review flow: pre-check lists, checklist builder, delegation
    path("sheets/<uuid:pk>/precheck", precheck_views.SheetPrecheckView.as_view()),
    path("checklists", precheck_views.ChecklistListView.as_view()),
    path("checklists/<uuid:pk>", precheck_views.ChecklistDetailView.as_view()),
    path("delegations", precheck_views.DelegationListView.as_view()),
    path("delegations/<uuid:pk>", precheck_views.DelegationDetailView.as_view()),
    # S6 dashboards, reports, activity, cross-project sheet list
    path("dashboards/portfolio", dashboard_views.PortfolioView.as_view()),
    path("dashboards/projects/<uuid:pk>", dashboard_views.ProjectDashboardView.as_view()),
    path("dashboards/disciplines/<str:code>", dashboard_views.DisciplineDashboardView.as_view()),
    path("dashboards/me", dashboard_views.MyWorkView.as_view()),
    path("reports/baseline", dashboard_views.BaselineView.as_view()),
    path("reports/hours", dashboard_views.HoursReportView.as_view()),
    path("sheets", dashboard_views.SheetListView.as_view()),
    path("search", SearchView.as_view()),
    path("exports", export_views.ExportListView.as_view()),
    path("exports/<uuid:pk>", export_views.ExportDetailView.as_view()),
    path("onboarding", onboarding_views.OnboardingStartView.as_view()),
    path("onboarding/<uuid:pk>", onboarding_views.OnboardingDetailView.as_view()),
    path("onboarding/<uuid:pk>/files", onboarding_views.OnboardingFilesView.as_view()),
    path("onboarding/<uuid:pk>/commit", onboarding_views.OnboardingCommitView.as_view()),
    path("projects/<uuid:project_pk>/activity", ActivityView.as_view()),
    # S5 people: staff, leave, allocations, workload, timesheets
    path("staff", people_views.StaffListView.as_view()),
    path("staff/<uuid:pk>", people_views.StaffDetailView.as_view()),
    path("leave", people_views.LeaveListView.as_view()),
    path("leave/<uuid:pk>", people_views.LeaveDetailView.as_view()),
    path("allocations", people_views.AllocationView.as_view()),
    path("allocations/copy-forward", people_views.CopyForwardView.as_view()),
    path("workload", people_views.WorkloadView.as_view()),
    path("timesheets/me", people_views.MyTimesheetView.as_view()),
    path("timesheets/approvals", people_views.ApprovalsView.as_view()),
    path("timesheets/import", people_views.TimesheetImportView.as_view()),
    path("timesheets/<uuid:pk>/entries", people_views.TimesheetEntriesView.as_view()),
    path("timesheets/<uuid:pk>/submit", people_views.TimesheetSubmitView.as_view()),
    path("timesheets/<uuid:pk>/approve", people_views.TimesheetApproveView.as_view()),
    path("timesheets/<uuid:pk>/return", people_views.TimesheetReturnView.as_view()),
    *router.urls,
]

urlpatterns = [
    path("api/v1/", include(api_v1)),
    path("api/v1/schema", SpectacularAPIView.as_view(), name="schema"),
    path("_allauth/", include("allauth.headless.urls")),
    # S-15 public transmittal page (no login, token link)
    path("t/<str:token>/", transmittal_public.transmittal_page, name="transmittal-public"),
    path("t/<str:token>/r/<uuid:revision_id>", transmittal_public.download_revision),
    path("t/<str:token>/zip", transmittal_public.download_zip),
    path("t/<str:token>/cover", transmittal_public.download_cover),
    path("t/<str:token>/ack", transmittal_public.acknowledge_receipt),
    path("integrations/inbound-email", inbound_email_webhook),
    path("integrations/cron/tick", cron_tick),
    # F-51 site view (S-18): magic link, no login
    path("site/<str:token>/", transmittal_site.site_page, name="site-view"),
    path("site/<str:token>/r/<uuid:revision_id>", transmittal_site.site_download),
    path("accounts/", include("allauth.urls")),
    # Support admin lives apart from the SPA's /admin screens (DD-009).
    path("django-admin/", admin.site.urls),
    path("healthz", healthz),
    path("livez", livez),
    path("", include("django_prometheus.urls")),
]
