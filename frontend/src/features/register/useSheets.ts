import { useQuery } from "@tanstack/react-query";

import type { FlagKind } from "@/components/ui/status";
import { api, type Schemas, unwrap } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import { projectKeys } from "@/features/projects/api";

export type Sheet = Schemas["Sheet"];
export type SheetFlag = NonNullable<Sheet["flags"]>[number];

export function useSheets(projectId: string) {
  return useQuery({
    queryKey: projectKeys.sheets(projectId),
    queryFn: () => unwrap(api.GET("/api/v1/projects/{project_pk}/sheets", { params: { path: { project_pk: projectId } } })),
  });
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Flag text as DESIGN.md §2.3: "Due in 4 days", "Late 3 days". Days are working days. */
export function flagFor(flag: SheetFlag): { kind: FlagKind; text: string; detail: string } {
  const days = typeof flag.days === "number" ? flag.days : null;
  const raised = `Raised ${formatDate(flag.raised_at)} by rule ${flag.rule}.`;
  if (flag.kind === "at_risk") {
    return { kind: "at_risk", text: days === 0 ? "Due today" : `Due in ${plural(days ?? 0, "day")}`, detail: `Planned date within the at-risk window (working days). ${raised}` };
  }
  if (flag.kind === "late") {
    return {
      kind: "late",
      text: `Late ${plural(days ?? 0, "day")}`,
      detail: `Planned date passed without an issue.${flag.escalated ? " Escalated to the project lead." : ""} ${raised}`,
    };
  }
  return { kind: flag.kind as FlagKind, text: flag.kind.replace(/_/g, " "), detail: raised };
}
