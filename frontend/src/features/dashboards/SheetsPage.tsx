import { useSearchParams } from "react-router";

import { Card, PageHeader, tableClass, tdClass, thClass } from "@/components/ui/PageHeader";
import { DataState, EmptyState } from "@/components/ui/States";
import { ExportButton } from "@/features/exports/ExportButton";
import { formatDate } from "@/lib/format";

import { useOrgSheets } from "./api";
import { SheetLink, SheetStatus } from "./SheetRow";

const TITLES: Record<string, string> = {
  late: "Late sheets",
  at_risk: "At-risk sheets",
};

/** Sheets across the viewer's projects with one filter applied (where portfolio numbers land). */
export function SheetsPage() {
  const [params, setParams] = useSearchParams();
  const flag = params.getAll("flag");
  const state = params.getAll("state");
  const sheets = useOrgSheets({ flag, state });
  const rows = sheets.data ?? [];
  const title = flag.length === 1 ? TITLES[flag[0]!] ?? "Sheets" : state.length ? "Sheets waiting for review" : "Late and at-risk sheets";
  const toggle = (value: string) => {
    const next = new URLSearchParams(params);
    const current = next.getAll("flag");
    next.delete("flag");
    for (const f of current.includes(value) ? current.filter((f) => f !== value) : [...current, value]) next.append("flag", f);
    setParams(next, { replace: true });
  };

  return (
    <>
      <PageHeader
        title={title}
        meta={`${rows.length} sheet${rows.length === 1 ? "" : "s"} across your projects${rows.length >= 1000 ? " (first 1,000)" : ""}`}
        actions={<ExportButton kind="late_at_risk" params={params} />}
      />
      <div className="mb-3 flex gap-3" role="group" aria-label="Flags">
        {(["late", "at_risk"] as const).map((f) => (
          <label key={f} className="inline-flex items-center gap-1.5 text-small">
            <input type="checkbox" checked={flag.includes(f)} onChange={() => toggle(f)} /> {TITLES[f]}
          </label>
        ))}
      </div>
      <Card>
        <DataState isPending={sheets.isPending} error={sheets.error} isEmpty={rows.length === 0} onRetry={() => sheets.refetch()} empty={<EmptyState message="No sheets match. Good news." />}>
          <table className={tableClass}>
            <thead>
              <tr>
                <th scope="col" className={thClass}>Sheet</th>
                <th scope="col" className={thClass}>Disc</th>
                <th scope="col" className={thClass}>Owner</th>
                <th scope="col" className={thClass}>State</th>
                <th scope="col" className={thClass}>Planned</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td className={tdClass}><SheetLink sheet={s} showProject /></td>
                  <td className={tdClass}>{s.discipline_code}</td>
                  <td className={tdClass}>{s.owner_name ?? "—"}</td>
                  <td className={tdClass}><SheetStatus sheet={s} /></td>
                  <td className={`${tdClass} tabular`}>{formatDate(s.planned_issue_date) || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </Card>
    </>
  );
}
