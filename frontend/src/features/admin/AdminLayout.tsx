import { Navigate, NavLink, Outlet } from "react-router";

import type { Me } from "@/lib/auth/useMe";
import { cn } from "@/lib/cn";

const SECTIONS = [
  { to: "organisation", label: "Organisation", needs: "manage_org_settings" },
  { to: "disciplines", label: "Disciplines", needs: "manage_org_settings" },
  { to: "stage-templates", label: "Stage templates", needs: "manage_org_settings" },
  { to: "naming-rules", label: "Naming rules", needs: "manage_org_settings" },
  { to: "checklists", label: "Checklists", needs: "manage_org_settings" },
  { to: "intelligence", label: "Intelligence", needs: "manage_org_settings" },
  { to: "calendar", label: "Working calendar", needs: "manage_org_settings" },
  { to: "automation", label: "Automation", needs: "manage_org_settings" },
  { to: "users", label: "Users and roles", needs: "manage_org_settings" },
  { to: "/contacts", label: "Contacts", needs: "manage_org_settings" },
  { to: "integrations", label: "Integrations", needs: "manage_org_settings" },
  { to: "onboarding", label: "Onboarding", needs: "manage_org_settings" },
  { to: "audit", label: "Audit trail", needs: "export_audit" },
] as const;

/** S-14 Admin settings. */
export function AdminLayout({ me }: { me: Me }) {
  const visible = SECTIONS.filter((s) => me.capabilities[s.needs]);
  if (visible.length === 0) return <Navigate to="/" replace />;
  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <nav aria-label="Admin sections" className="shrink-0 lg:w-52">
        <h1 className="mb-2 text-title font-semibold">Admin</h1>
        <ul className="flex flex-wrap gap-1 lg:flex-col">
          {visible.map((s) => (
            <li key={s.to}>
              <NavLink
                to={s.to}
                className={({ isActive }) =>
                  cn("block rounded-sm px-3 py-1.5 text-body", isActive ? "bg-surface-muted font-semibold text-primary" : "hover:bg-surface-muted")
                }
              >
                {s.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}

export function AdminIndex({ me }: { me: Me }) {
  return <Navigate to={me.capabilities.manage_org_settings ? "organisation" : "audit"} replace />;
}
