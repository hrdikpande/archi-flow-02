import { BarChart3, BookOpen, BookUser, ReceiptIndianRupee, CheckCheck, Clock, FolderKanban, House, LayoutDashboard, LayoutGrid, type LucideIcon, Settings } from "lucide-react";

import type { Me } from "@/lib/auth/useMe";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  visible: (me: Me) => boolean;
  /** Shows a count badge, e.g. reviews waiting for me (DESIGN.md §3). */
  badge?: "reviews";
}

/** Left navigation (DESIGN.md §3), shown by role. Transmittals live under each project. */
export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "My work", icon: House, visible: () => true },
  { to: "/portfolio", label: "Portfolio", icon: LayoutDashboard, visible: (me) => me.capabilities.view_portfolio },
  { to: "/projects", label: "Projects", icon: FolderKanban, visible: () => true },
  { to: "/reviews", label: "Reviews", icon: CheckCheck, visible: () => true, badge: "reviews" },
  { to: "/workload", label: "Workload", icon: LayoutGrid, visible: () => true },
  {
    to: "/timesheets",
    label: "Timesheets",
    icon: Clock,
    visible: (me) => me.capabilities.log_own_timesheet || me.capabilities.allocate_hours,
  },
  {
    to: "/reports",
    label: "Reports",
    icon: BarChart3,
    visible: (me) => me.capabilities.view_baseline || me.capabilities.view_hours_report,
  },
  { to: "/knowledge", label: "Knowledge", icon: BookOpen, visible: () => true },
  { to: "/billing", label: "Billing", icon: ReceiptIndianRupee, visible: (me) => me.capabilities.view_billing },
  { to: "/contacts", label: "Contacts", icon: BookUser, visible: () => true },
  {
    to: "/admin",
    label: "Admin",
    icon: Settings,
    visible: (me) => me.capabilities.manage_org_settings || me.capabilities.export_audit,
  },
];
