import { Link } from "react-router";

import { BurnUpChart } from "@/components/ui/BurnUpChart";
import { MetricCard } from "@/components/ui/MetricCard";
import { Card, tableClass, tdClass, thClass } from "@/components/ui/PageHeader";
import { DataState, EmptyState } from "@/components/ui/States";
import { formatDate, formatTime, todayISO } from "@/lib/format";

import { registerLink, useProjectDashboard } from "./api";
import { SheetLink } from "./SheetRow";

/** S-04 project overview cards (D-02, F-23). Every card links to the list behind it. */
export function ProjectDashboard({ projectId }: { projectId: string }) {
  const dash = useProjectDashboard(projectId);
  const data = dash.data;
  const totals = (data?.by_discipline ?? []).reduce(
    (t, d) => ({ planned: t.planned + d.planned, issued: t.issued + d.issued, late: t.late + d.late, at_risk: t.at_risk + d.at_risk, in_check: t.in_check + d.in_check }),
    { planned: 0, issued: 0, late: 0, at_risk: 0, in_check: 0 },
  );
  return (
    <DataState isPending={dash.isPending} error={dash.error} isEmpty={false} empty={null} onRetry={() => dash.refetch()}>
      {data && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-3">
            <MetricCard label="Issued / planned" value={`${totals.issued} / ${totals.planned}`} to={registerLink(projectId)} hint={data.updated_at ? `updated ${formatTime(data.updated_at)}` : undefined} />
            <MetricCard label="Late" value={totals.late} to={registerLink(projectId, { late: "1" })} />
            <MetricCard label="At risk" value={totals.at_risk} to={registerLink(projectId, { risk: "1" })} />
            <MetricCard label="In check" value={totals.in_check} to={registerLink(projectId, { state: "in_check" })} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Sheets planned vs issued">
              <BurnUpChart weeks={data.burn_up.weeks} series={data.burn_up.series} today={todayISO()} />
            </Card>
            <Card title="Late sheets" actions={totals.late > 10 && <Link className="text-small text-primary underline" to={registerLink(projectId, { late: "1" })}>All {totals.late}</Link>}>
              {data.late.length === 0 ? (
                <EmptyState message="No late sheets." />
              ) : (
                <table className={tableClass}>
                  <tbody>
                    {data.late.map((l) => (
                      <tr key={l.sheet.id}>
                        <td className={tdClass}><SheetLink sheet={l.sheet} /></td>
                        <td className={tdClass}>{l.owner ?? "—"}</td>
                        <td className={`${tdClass} text-right tabular`} style={{ color: "var(--flag-late-fg)" }}>Late {l.days} {l.days === 1 ? "day" : "days"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
            <Card title="Team allocation this week" actions={<Link className="text-small text-primary underline" to="/workload">Workload</Link>}>
              {data.team_this_week.length === 0 ? (
                <EmptyState message="No hours allocated on this project this week." />
              ) : (
                <table className={tableClass}>
                  <thead>
                    <tr>
                      <th scope="col" className={thClass}>Person</th>
                      <th scope="col" className={`${thClass} text-right`}>Here</th>
                      <th scope="col" className={`${thClass} text-right`}>All projects</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.team_this_week.map((t) => {
                      const over = t.pct !== null && t.pct > 110;
                      return (
                        <tr key={t.user.id}>
                          <td className={tdClass}>{t.user.full_name}</td>
                          <td className={`${tdClass} text-right tabular`}>{t.planned_h} h</td>
                          <td className={`${tdClass} text-right tabular`} style={over ? { color: "var(--flag-over_allocated-fg)" } : undefined}>
                            {t.total_h} / {t.capacity_h} h{t.pct !== null && ` (${t.pct}%)`}{over && <span className="sr-only"> over-allocated</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </Card>
            {data.unacknowledged.length > 0 && (
              <Card title={`Not acknowledged · ${data.unacknowledged.length}`}>
                <table className={tableClass}>
                  <tbody>
                    {data.unacknowledged.map((u) => (
                      <tr key={`${u.transmittal}-${u.contact}`}>
                        <td className={tdClass}><Link className="mono hover:underline" to={`transmittals/${u.transmittal}`}>{u.number}</Link></td>
                        <td className={tdClass}>{u.contact}</td>
                        <td className={`${tdClass} text-right tabular`}>{u.days} days since sent</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
            <Card title="Recent transmittals" actions={<Link className="text-small text-primary underline" to="transmittals">All</Link>}>
              {data.transmittals.length === 0 ? (
                <EmptyState message="Nothing issued yet." />
              ) : (
                <table className={tableClass}>
                  <tbody>
                    {data.transmittals.map((t) => (
                      <tr key={t.id}>
                        <td className={tdClass}><Link className="mono hover:underline" to={`transmittals/${t.id}`}>{t.number}</Link></td>
                        <td className={tdClass}>{t.purpose}</td>
                        <td className={`${tdClass} tabular`}>{formatDate(t.sent_at)}</td>
                        <td className={`${tdClass} text-small text-muted`}>{t.sheets} sheets · {t.recipients} recipients</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </div>
        </div>
      )}
    </DataState>
  );
}
