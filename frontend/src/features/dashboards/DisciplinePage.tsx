import { useParams } from "react-router";

import { Card, PageHeader, tableClass, tdClass, thClass } from "@/components/ui/PageHeader";
import { SHEET_STATES, type SheetState } from "@/components/ui/status";
import { DataState, EmptyState } from "@/components/ui/States";
import { isoWeek } from "@/features/people/api";
import { formatDate } from "@/lib/format";

import { useDisciplineDashboard } from "./api";
import { SheetLink, SheetStatus } from "./SheetRow";

/** D-03 Discipline dashboard (F-23): assignments, check queue, capacity this week and next. */
export function DisciplinePage() {
  const { code = "" } = useParams();
  const dash = useDisciplineDashboard(code);
  const data = dash.data;
  return (
    <>
      <PageHeader title={data ? `${data.discipline.code} · ${data.discipline.name}` : "Discipline"} meta={data && `${data.projects} active project${data.projects === 1 ? "" : "s"} you lead in this discipline`} />
      <DataState isPending={dash.isPending} error={dash.error} isEmpty={false} empty={null} onRetry={() => dash.refetch()}>
        {data && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Assignments">
              {data.assignments.length === 0 ? (
                <EmptyState message="No open sheets in this discipline." />
              ) : (
                <table className={tableClass}>
                  <thead>
                    <tr>
                      <th scope="col" className={thClass}>Designer</th>
                      <th scope="col" className={`${thClass} text-right`}>Open</th>
                      <th scope="col" className={thClass}>By state</th>
                      <th scope="col" className={`${thClass} text-right`}>Late</th>
                      <th scope="col" className={thClass}>Next due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.assignments.map((a) => (
                      <tr key={a.owner?.id ?? "none"}>
                        <td className={tdClass}>{a.owner?.full_name ?? "Unassigned"}</td>
                        <td className={`${tdClass} text-right tabular`}>{a.total}</td>
                        <td className={`${tdClass} text-small`}>
                          {Object.entries(a.by_state).map(([s, n]) => `${SHEET_STATES[s as SheetState]?.label ?? s} ${n}`).join(" · ")}
                        </td>
                        <td className={`${tdClass} text-right tabular`}>{a.late}</td>
                        <td className={`${tdClass} tabular`}>{formatDate(a.next_due) || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
            <Card title={`Check queue · ${data.check_queue.length}`}>
              {data.check_queue.length === 0 ? (
                <EmptyState message="No sheets are waiting for a check." />
              ) : (
                <table className={tableClass}>
                  <thead>
                    <tr>
                      <th scope="col" className={thClass}>Sheet</th>
                      <th scope="col" className={thClass}>Checker</th>
                      <th scope="col" className={`${thClass} text-right`}>Waiting</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.check_queue.map((q) => (
                      <tr key={q.sheet.id}>
                        <td className={tdClass}><SheetLink sheet={q.sheet} showProject /> <SheetStatus sheet={q.sheet} /></td>
                        <td className={tdClass}>{q.checker ?? "—"}</td>
                        <td className={`${tdClass} text-right tabular`}>{q.working_days} d</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
            <Card title="Capacity this week and next">
              {data.capacity.length === 0 ? (
                <EmptyState message="No one in this discipline yet. Set disciplines in Workload › Staff." />
              ) : (
                <table className={tableClass}>
                  <thead>
                    <tr>
                      <th scope="col" className={thClass}>Person</th>
                      {data.capacity[0]!.cells.map((c) => <th key={c.week} scope="col" className={`${thClass} text-right`}>W{isoWeek(c.week)}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {data.capacity.map((p) => (
                      <tr key={p.user.id}>
                        <td className={tdClass}>{p.user.full_name}</td>
                        {p.cells.map((c) => {
                          const kind = c.pct === null ? null : c.pct > 110 ? "over_allocated" : c.pct < 50 ? "under_allocated" : null;
                          return (
                            <td key={c.week} className={`${tdClass} text-right tabular`} style={kind ? { color: `var(--flag-${kind}-fg)`, background: `var(--flag-${kind}-bg)` } : undefined}>
                              {c.pct === null ? "Leave" : `${c.pct}%`} <span className="text-small text-muted">{c.planned_h}/{c.capacity_h} h</span>
                              {kind && <span className="sr-only"> {kind.replace("_", "-")}</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </div>
        )}
      </DataState>
    </>
  );
}
