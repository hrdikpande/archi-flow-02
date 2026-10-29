import type { LucideIcon } from "lucide-react";
import { useSearchParams } from "react-router";

import { Select } from "@/components/ui/Field";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { useMembers } from "@/features/projects/api";
import { useProjectContext } from "@/features/projects/ProjectLayout";
import { useSheets } from "@/features/register/useSheets";

export type Tone = "in_progress" | "in_check" | "approved_for_issue" | "issued" | "cancelled" | "changes_requested" | "planned";

/** Status is colour + icon + word (CLAUDE.md, DESIGN.md §2): tones reuse the state tokens. */
export function Pill({ label, icon: Icon, tone }: { label: string; icon: LucideIcon; tone: Tone }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-small font-semibold whitespace-nowrap"
      style={{ color: `var(--state-${tone}-fg)`, background: `var(--state-${tone}-bg)` }}
    >
      <Icon size={14} aria-hidden="true" /> {label}
    </span>
  );
}

export const PARTY: Record<string, string> = { firm: "Us", client: "Client", contractor: "Contractor", consultant: "Consultant", "": "—" };

/** `?open=<id>` keeps the open drawer in the URL, so notification links land on it. */
export function useOpenParam(): [string | null, (id: string | null) => void] {
  const [params, setParams] = useSearchParams();
  const set = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set("open", id);
    else next.delete("open");
    setParams(next, { replace: true });
  };
  return [params.get("open"), set];
}

export function SheetsPicker({ value, onChange, label = "Linked sheets" }: { value: string[]; onChange: (v: string[]) => void; label?: string }) {
  const { project } = useProjectContext();
  const sheets = useSheets(project.id);
  return <MultiSelect label={label} options={(sheets.data ?? []).map((s) => ({ value: s.id, label: `${s.number} ${s.title}` }))} value={value} onChange={onChange} />;
}

export function MemberSelect({ value, onChange, id, ...aria }: { value: string; onChange: (v: string) => void; id?: string; "aria-describedby"?: string }) {
  const { project } = useProjectContext();
  const members = useMembers(project.id);
  const people = new Map((members.data ?? []).map((m) => [m.user.id, m.user.full_name]));
  return (
    <Select id={id} {...aria} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Nobody yet</option>
      {[...people].map(([uid, name]) => <option key={uid} value={uid}>{name}</option>)}
    </Select>
  );
}

export function LinkedSheets({ refs }: { refs: { id: string; number: string }[] }) {
  const { project } = useProjectContext();
  if (!refs.length) return <span className="text-muted">—</span>;
  return (
    <span className="mono text-small">
      {refs.map((s, i) => (
        <span key={s.id}>{i > 0 && ", "}<a className="hover:underline" href={`/projects/${project.id}/sheets/${s.id}`}>{s.number}</a></span>
      ))}
    </span>
  );
}
