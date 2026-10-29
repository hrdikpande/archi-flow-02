import * as Menu from "@radix-ui/react-dropdown-menu";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, LogOut, Monitor, Moon, PanelLeftClose, PanelLeftOpen, Sun } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router";

import { allauth } from "@/lib/auth/allauth";
import type { Me } from "@/lib/auth/useMe";
import { cn } from "@/lib/cn";
import { applyTheme, readTheme, type ThemeChoice } from "@/lib/theme";

import { NotificationsBell } from "@/features/notifications/NotificationsBell";
import { CommandPalette } from "@/features/search/CommandPalette";
import { useReviewQueue } from "@/features/reviews/ReviewQueuePage";

import { NAV_ITEMS } from "./nav";

const THEMES: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "Match system", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/** Top bar 56 px, left nav 232 px collapsible to 64 px (DESIGN.md §3). */
export function AppShell({ me }: { me: Me }) {
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState<ThemeChoice>(readTheme);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const reviews = useReviewQueue();
  const reviewCount = reviews.data?.length ?? 0;

  const signOut = async () => {
    await allauth.logout();
    queryClient.clear();
    navigate("/sign-in", { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-surface px-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-sm p-1.5 text-muted hover:bg-surface-muted"
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            aria-expanded={!collapsed}
            aria-controls="primary-nav"
            onClick={() => setCollapsed((c) => !c)}
          >
            {collapsed ? <PanelLeftOpen size={18} aria-hidden="true" /> : <PanelLeftClose size={18} aria-hidden="true" />}
          </button>
          <span className="flex items-center gap-2 font-semibold">
            <img src="/favicon.svg" alt="" width={22} height={22} />
            DrawingOps
          </span>
          <span className="hidden text-small text-muted md:inline">· {me.organisation.name}</span>
        </div>
        <div className="flex flex-1 justify-center">
          <CommandPalette me={me} />
        </div>
        <div className="flex items-center gap-2">
        <NotificationsBell />
        <Menu.Root>
          <Menu.Trigger className="flex items-center gap-2 rounded-sm px-2 py-1 hover:bg-surface-muted">
            {/* Name as text, not aria-label: the visible initials must not contradict it (WCAG 2.5.3). */}
            <span className="sr-only">Account menu for {me.full_name || me.email}</span>
            <span
              aria-hidden="true"
              className="grid h-7 w-7 place-items-center rounded-full bg-primary text-small font-semibold text-on-primary"
            >
              {initials(me.full_name || me.email)}
            </span>
            <ChevronDown size={14} aria-hidden="true" />
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Content
              align="end"
              sideOffset={6}
              className="z-50 min-w-56 rounded-md border border-border bg-surface p-1 text-body shadow-overlay"
            >
              <div className="px-3 py-2">
                <p className="font-semibold">{me.full_name || me.email}</p>
                <p className="text-small text-muted">{me.email}</p>
              </div>
              <Menu.Separator className="my-1 h-px bg-border" />
              <Menu.Label className="px-3 py-1 text-small text-muted">Theme</Menu.Label>
              <Menu.RadioGroup
                value={theme}
                onValueChange={(v) => {
                  setTheme(v as ThemeChoice);
                  applyTheme(v as ThemeChoice);
                }}
              >
                {THEMES.map(({ value, label, icon: Icon }) => (
                  <Menu.RadioItem
                    key={value}
                    value={value}
                    className="flex cursor-pointer items-center gap-2 rounded-sm px-3 py-1.5 outline-none data-[highlighted]:bg-surface-muted data-[state=checked]:font-semibold"
                  >
                    <Icon size={14} aria-hidden="true" />
                    {label}
                  </Menu.RadioItem>
                ))}
              </Menu.RadioGroup>
              <Menu.Separator className="my-1 h-px bg-border" />
              <Menu.Item
                onSelect={() => navigate("/settings/notifications")}
                className="flex cursor-pointer items-center gap-2 rounded-sm px-3 py-1.5 outline-none data-[highlighted]:bg-surface-muted"
              >
                Notification preferences
              </Menu.Item>
              <Menu.Item
                onSelect={signOut}
                className="flex cursor-pointer items-center gap-2 rounded-sm px-3 py-1.5 outline-none data-[highlighted]:bg-surface-muted"
              >
                <LogOut size={14} aria-hidden="true" />
                Sign out
              </Menu.Item>
            </Menu.Content>
          </Menu.Portal>
        </Menu.Root>
        </div>
      </header>
      <div className="flex flex-1">
        <nav
          id="primary-nav"
          aria-label="Primary"
          className={cn(
            "shrink-0 border-r border-border bg-surface py-3 transition-[width] motion-reduce:transition-none",
            collapsed ? "w-16" : "w-[232px] max-md:w-16",
          )}
        >
          <ul className="flex flex-col gap-0.5 px-2">
            {NAV_ITEMS.filter((item) => item.visible(me)).map(({ to, label, icon: Icon, badge }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === "/"}
                  title={label}
                  className={({ isActive }) =>
                    cn(
                      "motion-hover flex h-9 items-center gap-3 rounded-sm px-3 text-body",
                      isActive ? "bg-surface-muted font-semibold text-primary" : "text-text hover:bg-surface-muted",
                    )
                  }
                >
                  <Icon size={18} aria-hidden="true" className="shrink-0" />
                  <span className={cn("flex-1", collapsed ? "sr-only" : "max-md:sr-only")}>{label}</span>
                  {badge === "reviews" && reviewCount > 0 && (
                    <span className="rounded-full bg-primary px-1.5 text-small font-semibold text-on-primary tabular" aria-label={`${reviewCount} waiting`}>
                      {reviewCount}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
