import { lazy, type ReactNode, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router";

import { SkeletonRows } from "@/components/ui/States";
import { AdminIndex, AdminLayout } from "@/features/admin/AdminLayout";
import { SignInPage } from "@/features/auth/SignInPage";
import { ContactsPage } from "@/features/contacts/ContactsPage";
import { BillingPage } from "@/features/billing/BillingPage";
import { CommentsTab } from "@/features/comments/CommentsTab";
import { ChangeOrders } from "@/features/construction/ChangeOrders";
import { Clashes } from "@/features/construction/Clashes";
import { ConstructionTab } from "@/features/construction/ConstructionTab";
import { RfiLog } from "@/features/construction/RfiLog";
import { SiteReports } from "@/features/construction/SiteReports";
import { SubmittalLog } from "@/features/construction/SubmittalLog";
import { FindingsQueuePage } from "@/features/intelligence/FindingsQueuePage";
import { DecisionsTab } from "@/features/knowledge/DecisionsTab";
import { KnowledgePage } from "@/features/knowledge/KnowledgePage";
import { DisciplinePage } from "@/features/dashboards/DisciplinePage";
import { MyWorkPage } from "@/features/dashboards/MyWorkPage";
import { PortfolioPage } from "@/features/dashboards/PortfolioPage";
import { ReportsPage } from "@/features/dashboards/ReportsPage";
import { SheetsPage } from "@/features/dashboards/SheetsPage";
import { ExportJobPage } from "@/features/exports/ExportJobPage";
import { NotFoundPage } from "@/features/home/HomePage";
import { ActivityTab } from "@/features/projects/ActivityTab";
import { ProjectFacts } from "@/features/projects/ProjectOverview";
import { ProjectLayout } from "@/features/projects/ProjectLayout";
import { ProjectsPage } from "@/features/projects/ProjectsPage";
import { StagePlanEditor } from "@/features/projects/StagePlanEditor";
import { TeamTab } from "@/features/projects/TeamTab";
import { CadSyncPage } from "@/features/register/CadSyncPage";
import { ImportWizard } from "@/features/register/ImportWizard";
import { RegisterPage } from "@/features/register/RegisterPage";
import { ReviewQueuePage } from "@/features/reviews/ReviewQueuePage";
import { PreferencesPage } from "@/features/notifications/PreferencesPage";
import { StaffPage } from "@/features/people/StaffPage";
import { ApprovalsPage, TimesheetPage } from "@/features/people/TimesheetPage";
import { WorkloadPage } from "@/features/people/WorkloadPage";
import { SheetDetailPage } from "@/features/sheets/SheetDetailPage";
import { IssueComposer } from "@/features/transmittals/IssueComposer";
import { TransmittalDetail, TransmittalsTab } from "@/features/transmittals/TransmittalsTab";

import { AppShell } from "./AppShell";
import { RequireAuth } from "./RequireAuth";

// Admin screens and 2FA setup are used by few people: load them on demand.
const AuditLog = lazy(() => import("@/features/admin/AuditLog").then((m) => ({ default: m.AuditLog })));
const CalendarSettings = lazy(() => import("@/features/admin/CalendarSettings").then((m) => ({ default: m.CalendarSettings })));
const DisciplinesSettings = lazy(() => import("@/features/admin/DisciplinesSettings").then((m) => ({ default: m.DisciplinesSettings })));
const IntegrationsSettings = lazy(() => import("@/features/admin/IntegrationsSettings").then((m) => ({ default: m.IntegrationsSettings })));
const NamingRulesSettings = lazy(() => import("@/features/admin/NamingRulesSettings").then((m) => ({ default: m.NamingRulesSettings })));
const OrganisationSettings = lazy(() => import("@/features/admin/OrganisationSettings").then((m) => ({ default: m.OrganisationSettings })));
const StageTemplatesSettings = lazy(() => import("@/features/admin/StageTemplatesSettings").then((m) => ({ default: m.StageTemplatesSettings })));
const UsersSettings = lazy(() => import("@/features/admin/UsersSettings").then((m) => ({ default: m.UsersSettings })));
const AutomationSettings = lazy(() => import("@/features/admin/AutomationSettings").then((m) => ({ default: m.AutomationSettings })));
const IntelligenceSettings = lazy(() => import("@/features/admin/IntelligenceSettings").then((m) => ({ default: m.IntelligenceSettings })));
const ChecklistSettings = lazy(() => import("@/features/admin/ChecklistSettings").then((m) => ({ default: m.ChecklistSettings })));
const OnboardingSettings = lazy(() => import("@/features/admin/OnboardingSettings").then((m) => ({ default: m.OnboardingSettings })));
const MfaSetupPage = lazy(() => import("@/features/auth/MfaSetupPage").then((m) => ({ default: m.MfaSetupPage })));

const page = (node: ReactNode) => <Suspense fallback={<SkeletonRows label="Loading page" />}>{node}</Suspense>;
const withMe = (render: (me: Parameters<Parameters<typeof RequireAuth>[0]["children"]>[0]) => ReactNode) => <RequireAuth>{render}</RequireAuth>;

export const projectRoutes = [
  { index: true, element: <ProjectFacts /> },
  { path: "register", element: <RegisterPage /> },
  { path: "import", element: <ImportWizard /> },
  { path: "sheets/:sheetId", element: <SheetDetailPage /> },
  { path: "stages", element: <StagePlanEditor /> },
  { path: "team", element: <TeamTab /> },
  { path: "issue", element: <IssueComposer /> },
  { path: "transmittals", element: <TransmittalsTab /> },
  { path: "transmittals/:transmittalId", element: <TransmittalDetail /> },
  { path: "activity", element: <ActivityTab /> },
  { path: "comments", element: <CommentsTab /> },
  { path: "cad-sync", element: <CadSyncPage /> },
  { path: "decisions", element: <DecisionsTab /> },
  {
    path: "construction",
    element: <ConstructionTab />,
    children: [
      { index: true, element: <Navigate to="rfis" replace /> },
      { path: "rfis", element: <RfiLog /> },
      { path: "submittals", element: <SubmittalLog /> },
      { path: "site", element: <SiteReports /> },
      { path: "changes", element: <ChangeOrders /> },
      { path: "clashes", element: <Clashes /> },
    ],
  },
];

export const router = createBrowserRouter([
  { path: "/sign-in", element: <SignInPage /> },
  { path: "/setup-2fa", element: withMe(() => page(<MfaSetupPage />)) },
  {
    path: "/",
    element: withMe((me) => <AppShell me={me} />),
    children: [
      { index: true, element: withMe((me) => <MyWorkPage me={me} />) },
      { path: "portfolio", element: <PortfolioPage /> },
      { path: "sheets", element: <SheetsPage /> },
      { path: "disciplines/:code", element: <DisciplinePage /> },
      { path: "reports", element: withMe((me) => <ReportsPage me={me} />) },
      { path: "exports/:exportId", element: <ExportJobPage /> },
      { path: "knowledge", element: <KnowledgePage /> },
      { path: "intelligence/findings", element: <FindingsQueuePage /> },
      { path: "billing", element: withMe((me) => <BillingPage me={me} state="ready" />) },
      { path: "billing/invoiced", element: withMe((me) => <BillingPage me={me} state="invoiced" />) },
      { path: "projects", element: withMe((me) => <ProjectsPage me={me} />) },
      { path: "projects/:projectId", element: <ProjectLayout />, children: projectRoutes },
      { path: "reviews", element: <ReviewQueuePage /> },
      { path: "workload", element: withMe((me) => <WorkloadPage me={me} />) },
      { path: "workload/staff", element: withMe((me) => <StaffPage me={me} />) },
      { path: "timesheets", element: withMe((me) => <TimesheetPage me={me} />) },
      { path: "timesheets/approvals", element: withMe((me) => <ApprovalsPage me={me} />) },
      { path: "settings/notifications", element: <PreferencesPage /> },
      { path: "contacts", element: withMe((me) => <ContactsPage me={me} />) },
      {
        path: "admin",
        element: withMe((me) => <AdminLayout me={me} />),
        children: [
          { index: true, element: withMe((me) => <AdminIndex me={me} />) },
          { path: "organisation", element: page(<OrganisationSettings />) },
          { path: "disciplines", element: page(<DisciplinesSettings />) },
          { path: "stage-templates", element: page(<StageTemplatesSettings />) },
          { path: "naming-rules", element: page(<NamingRulesSettings />) },
          { path: "automation", element: page(<AutomationSettings />) },
          { path: "calendar", element: page(<CalendarSettings />) },
          { path: "users", element: page(<UsersSettings />) },
          { path: "integrations", element: withMe((me) => page(<IntegrationsSettings me={me} />)) },
          { path: "audit", element: page(<AuditLog />) },
          { path: "onboarding", element: page(<OnboardingSettings />) },
          { path: "checklists", element: page(<ChecklistSettings />) },
          { path: "intelligence", element: page(<IntelligenceSettings />) },
        ],
      },
      { path: "home", element: <Navigate to="/" replace /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
