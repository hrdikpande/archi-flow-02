import * as Dialog from "@radix-ui/react-dialog";
import { FileText, FolderKanban, Search, Send, User, Zap } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useEffect, useId, useState } from "react";
import { useNavigate } from "react-router";

import { NAV_ITEMS } from "@/app/nav";
import { useSearch } from "@/features/dashboards/api";
import type { Me } from "@/lib/auth/useMe";
import { cn } from "@/lib/cn";

interface Item {
  id: string;
  group: string;
  icon: ReactNode;
  label: ReactNode;
  hint?: string;
  to: string;
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/** ⌘K / Ctrl+K command palette (F-44, DESIGN.md §3): sheets, projects, transmittals, contacts
 * and "Go to …" actions. Results come from the permission-scoped search API. */
export function CommandPalette({ me }: { me: Me }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className="hidden h-9 w-full max-w-md items-center gap-2 rounded-sm border border-border bg-surface-muted px-3 text-small text-muted hover:border-primary md:flex">
        <Search size={14} aria-hidden="true" />
        <span className="flex-1 text-left">Search sheets, projects, transmittals…</span>
        <kbd className="rounded-sm border border-border bg-surface px-1.5 font-sans text-[11px]">{isMac ? "⌘K" : "Ctrl K"}</kbd>
      </Dialog.Trigger>
      <Dialog.Trigger className="rounded-sm p-1.5 text-muted hover:bg-surface-muted md:hidden" aria-label="Search">
        <Search size={18} aria-hidden="true" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
        <Dialog.Content aria-describedby={undefined} className="fixed top-[12vh] left-1/2 z-50 w-[640px] max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-lg border border-border bg-surface shadow-overlay">
          <Dialog.Title className="sr-only">Search</Dialog.Title>
          {open && <Palette me={me} onDone={() => setOpen(false)} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Palette({ me, onDone }: { me: Me; onDone: () => void }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const result = useSearch(q);
  const term = q.trim().toLowerCase();

  const actions: Item[] = NAV_ITEMS.filter((n) => n.visible(me))
    .filter((n) => !term || `go to ${n.label}`.toLowerCase().includes(term))
    .map((n) => ({ id: `go:${n.to}`, group: "Go to", icon: <Zap size={14} aria-hidden="true" />, label: `Go to ${n.label}`, to: n.to }));
  const r = term.length >= 2 ? result.data : undefined;
  const items: Item[] = [
    ...(r?.sheets ?? []).map((s) => ({
      id: `s:${s.id}`, group: "Sheets", icon: <FileText size={14} aria-hidden="true" />,
      label: <><span className="mono font-semibold">{s.number}</span> {s.title}</>,
      hint: `${s.project_code}${s.current_revision_code ? ` · ${s.current_revision_code}` : ""}`,
      to: `/projects/${s.project}/sheets/${s.id}`,
    })),
    ...(r?.projects ?? []).map((p) => ({
      id: `p:${p.id}`, group: "Projects", icon: <FolderKanban size={14} aria-hidden="true" />,
      label: <><span className="mono">{p.code}</span> {p.name}</>, to: `/projects/${p.id}`,
    })),
    ...(r?.transmittals ?? []).map((t) => ({
      id: `t:${t.id}`, group: "Transmittals", icon: <Send size={14} aria-hidden="true" />,
      label: <span className="mono">{t.number}</span>, hint: t.purpose, to: `/projects/${t.project}/transmittals/${t.id}`,
    })),
    ...(r?.contacts ?? []).map((c) => ({
      id: `c:${c.id}`, group: "Contacts", icon: <User size={14} aria-hidden="true" />,
      label: c.full_name, hint: c.organisation_name ?? c.email, to: "/contacts",
    })),
    ...actions,
  ];
  const current = Math.min(active, Math.max(items.length - 1, 0));
  const go = (item?: Item) => {
    if (!item) return;
    onDone();
    navigate(item.to);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((current + 1) % Math.max(items.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((current - 1 + items.length) % Math.max(items.length, 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(items[current]);
    }
  };
  let lastGroup = "";

  return (
    <div>
      <div className="flex items-center gap-2 border-b border-border px-4">
        <Search size={16} aria-hidden="true" className="text-muted" />
        <input
          autoFocus
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-activedescendant={items[current] ? `${listId}-${items[current]!.id}` : undefined}
          aria-label="Search sheets, projects, transmittals and contacts"
          className="h-12 flex-1 bg-transparent text-body outline-none"
          placeholder="Type a sheet number, title, project or person"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKey}
        />
      </div>
      <ul id={listId} role="listbox" aria-label="Results" className="max-h-[60vh] overflow-y-auto p-2">
        {term.length >= 2 && result.isFetching && items.length === actions.length && <li className="px-3 py-2 text-small text-muted">Searching…</li>}
        {term.length >= 2 && !result.isFetching && items.length === 0 && <li className="px-3 py-2 text-small text-muted">No matches.</li>}
        {items.map((item, i) => {
          const header = item.group !== lastGroup ? item.group : null;
          lastGroup = item.group;
          return (
            <li key={item.id} role="presentation">
              {header && <p className="px-3 pt-2 pb-1 text-small font-semibold text-muted">{header}</p>}
              <div
                id={`${listId}-${item.id}`}
                role="option"
                aria-selected={i === current}
                className={cn("flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-body", i === current && "bg-surface-muted")}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(item)}
              >
                {item.icon}
                <span className="flex-1 truncate">{item.label}</span>
                {item.hint && <span className="text-small text-muted">{item.hint}</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
