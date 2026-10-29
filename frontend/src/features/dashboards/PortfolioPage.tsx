import { Link } from "react-router";

import { MetricCard } from "@/components/ui/MetricCard";
import { Card, PageHeader, tableClass, tdClass, thClass } from "@/components/ui/PageHeader";
import { StageChip } from "@/components/ui/StageChip";
import { DataState, EmptyState } from "@/components/ui/States";
import { ExportButton } from "@/features/exports/ExportButton";
import { isoWeek } from "@/features/people/api";
import { formatDate, formatINR, formatTime } from "@/lib/format";

import { type Portfolio, registerLink, usePortfolio } from "./api";

/** S-03 Portfolio (D-01, F-22): every active project; every number links to its list. */
export function PortfolioPage() {
  const portfolio = usePortfolio();
  const data = portfolio.data;
  return (
    <>
      <PageHeader
        title="Portfolio"
        meta={data && `Active projects ${data.active_projects} · Updated ${data.updated_at ? formatTime(data.updated_at) : "—"} (refreshed every 5 minutes)`}
        actions={<ExportButton kind="late_at_risk" />}
      />
      <DataState isPending={portfolio.isPending} error={portfolio.error} isEmpty={!data || data.active_projects === 0} onRetry={() => portfolio.refetch()} empty={<EmptyState message="No active projects to show." />}>
        {data && <PortfolioBody data={data} />}
      </DataState>
    </>
  );
}

function PortfolioBody({ data }: { data: Portfolio }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <MetricCard label="Late sheets" value={data.late} delta={data.late_delta} to="/sheets?flag=late" />
        <MetricCard label="At risk" value={data.at_risk} delta={data.at_risk_delta} to="/sheets?flag=at_risk" />
        <MetricCard label="Oldest review" value={data.oldest_review_days === null ? "—" : `${data.oldest_review_days} ${data.oldest_review_days === 1 ? "day" : "days"}`} to="/sheets?state=ready_for_check&state=in_check" hint="working days waiting" />
        <MetricCard label="Over-allocated" value={`${data.over_allocated_people} ${data.over_allocated_people === 1 ? "person" : "people"}`} to="/workload" hint="this week" />
        <MetricCard
          label="Ready to invoice"
          value={`${data.ready_to_invoice.stages} ${data.ready_to_invoice.stages === 1 ? "stage" : "stages"}`}
          hint={[Number(data.ready_to_invoice.amount) ? formatINR(data.ready_to_invoice.amount) : "", data.ready_to_invoice.oldest_days !== null ? `oldest ${data.ready_to_invoice.oldest_days} days` : ""].filter(Boolean).join(" · ") || undefined}
          to="/billing"
        />
      </div>
      <Card title="Projects">
        <div className="overflow-x-auto" role="region" aria-label="Projects" tabIndex={0}>
          <table className={tableClass}>
            <thead>
              <tr>
                <th scope="col" className={thClass}>Project</th>
                <th scope="col" className={thClass}>Stage</th>
                <th scope="col" className={thClass}>Sheets issued / planned</th>
                <th scope="col" className={`${thClass} text-right`}>Late</th>
                <th scope="col" className={`${thClass} text-right`}>At risk</th>
                <th scope="col" className={thClass}>Lead</th>
                <th scope="col" className={thClass}>Next stage date</th>
              </tr>
            </thead>
            <tbody>
              {data.projects.map((r) => {
                const pct = r.planned ? Math.round((r.issued / r.planned) * 100) : 0;
                return (
                  <tr key={r.project.id}>
                    <td className={tdClass}>
                      <Link to={`/projects/${r.project.id}`} className="hover:underline"><span className="mono">{r.project.code}</span> {r.project.name}</Link>
                    </td>
                    <td className={tdClass}>{r.stage ? <span className="inline-flex items-center gap-2">{r.stage.seq} {r.stage.name} <StageChip state={r.stage.state} /></span> : "—"}</td>
                    <td className={tdClass}>
                      <Link to={registerLink(r.project.id)} className="inline-flex items-center gap-2 hover:underline">
                        <span className="tabular">{r.issued} / {r.planned}</span>
                        <span className="sr-only">sheets issued ({pct}%)</span>
                        <span className="h-2 w-24 rounded-full bg-surface-muted" aria-hidden="true"><span className="block h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} /></span>
                      </Link>
                    </td>
                    <td className={`${tdClass} text-right tabular`}>{r.late ? <Link className="text-primary underline" to={registerLink(r.project.id, { late: "1" })}>{r.late}</Link> : 0}</td>
                    <td className={`${tdClass} text-right tabular`}>{r.at_risk ? <Link className="text-primary underline" to={registerLink(r.project.id, { risk: "1" })}>{r.at_risk}</Link> : 0}</td>
                    <td className={tdClass}>{r.leads.join(", ") || "—"}</td>
                    <td className={`${tdClass} tabular`}>{formatDate(r.next_stage_date) || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      {data.discipline_load.length > 0 && (
        <Card title="Discipline workload, next 4 weeks">
          <div className="overflow-x-auto" role="region" aria-label="Discipline workload" tabIndex={0}>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th scope="col" className={thClass}>Discipline</th>
                  {data.discipline_load[0]!.cells.map((c) => (
                    <th key={c.week} scope="col" className={`${thClass} text-right`}>W{isoWeek(c.week)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.discipline_load.map((d) => (
                  <tr key={d.discipline}>
                    <th scope="row" className={`${tdClass} font-normal`}><Link to={`/disciplines/${d.code}`} className="hover:underline">{d.code} · {d.name}</Link></th>
                    {d.cells.map((c) => {
                      const over = c.pct !== null && c.pct > 110;
                      return (
                        <td key={c.week} className={`${tdClass} text-right tabular`} style={over ? { color: "var(--flag-over_allocated-fg)", background: "var(--flag-over_allocated-bg)" } : undefined}>
                          {c.pct === null ? "—" : `${c.pct}%`}{over && <span className="sr-only"> over-allocated</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
