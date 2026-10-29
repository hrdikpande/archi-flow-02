import { NavLink } from "react-router";

import { cn } from "@/lib/cn";

export interface SubNavItem {
  to: string;
  label: string;
  end?: boolean;
}

/** Tabs under a page title, as links so each tab has its own URL (DESIGN.md §3). */
export function SubNav({ label, items }: { label: string; items: SubNavItem[] }) {
  return (
    <nav aria-label={label} className="mb-4 overflow-x-auto border-b border-border">
      <ul className="flex gap-1">
        {items.map((t) => (
          <li key={t.to}>
            <NavLink
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                cn(
                  "-mb-px block border-b-2 px-3 py-2 text-body whitespace-nowrap",
                  isActive ? "border-primary font-semibold text-primary" : "border-transparent text-muted hover:text-text",
                )
              }
            >
              {t.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
