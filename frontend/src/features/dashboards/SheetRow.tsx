import { Link } from "react-router";

import { FlagPill } from "@/components/ui/FlagPill";
import type { SheetState } from "@/components/ui/status";
import { StatusChip } from "@/components/ui/StatusChip";
import { flagFor } from "@/features/register/useSheets";

import type { SheetBrief } from "./api";

export const sheetPath = (s: { project: string; id: string }) => `/projects/${s.project}/sheets/${s.id}`;

/** Sheet number + title linking to the sheet; mono number (DESIGN.md §2.4). */
export function SheetLink({ sheet, showProject = false }: { sheet: SheetBrief; showProject?: boolean }) {
  return (
    <Link to={sheetPath(sheet)} className="hover:underline">
      {showProject && <span className="mono text-small text-muted">{sheet.project_code} · </span>}
      <span className="mono font-semibold">{sheet.number}</span> {sheet.title}
    </Link>
  );
}

export function SheetStatus({ sheet }: { sheet: SheetBrief }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <StatusChip state={sheet.state as SheetState} revision={sheet.current_revision_code ?? undefined} />
      {sheet.flags.map((f) => {
        const pill = flagFor(f);
        return <FlagPill key={f.kind} kind={pill.kind} text={pill.text} detail={pill.detail} />;
      })}
    </span>
  );
}
