import { useState } from "react";

import { Field, Select, TextInput } from "@/components/ui/Field";
import { MetricCard } from "@/components/ui/MetricCard";
import { Card, PageHeader, tableClass, tdClass, thClass } from "@/components/ui/PageHeader";
import { DataState, EmptyState } from "@/components/ui/States";
import { addDays } from "@/features/people/api";
import type { Me } from "@/lib/auth/useMe";
import { formatDate, todayISO } from "@/lib/format";

import { useBaseline, useHoursReport } from "./api";

type Group = "project" | "stage" | "person" | "discipline";
const GROUPS: Record<Group, string> = {
  project: "Hours by project (planned vs logged)",
  stage: "Hours by project and stage",
  person: "Utilisation by person (logged / available)",
  discipline: "Utilisation by discipline",
};

/** D-05 baseline metrics (F-53) and 03 §9 hour reports, for any date range. */
export function ReportsPage({ me }: { me: Me }) {
  const [from, setFrom] = useState(() => addDays(todayISO(), -90));
  const [to, setTo] = useState(() => todayISO());
  return (
    <>
      <PageHeader title="Reports" meta="Choose a period; every figure is recomputed for it." />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="From" className="w-44">{(p) => <TextInput {...p} type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />}</Field>
        <Field label="To" className="w-44">{(p) => <TextInput {...p} type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />}</Field>
      </div>
      <div className="flex flex-col gap-4">
        {me.capabilities.view_baseline && <BaselineReport from={from} to={to} />}
        {me.capabilities.view_hours_report && <HoursReport from={from} to={to} totalsOnly={me.org_role === "accounts"} />}
      </div>
    </>
  );
}

function BaselineReport({ from, to }: { from: string; to: string }) {
  const report = useBaseline(from, to);
  const d = report.data;
  return (
    <Card title={`Baseline metrics · ${formatDate(from)} to ${formatDate(to)}`}>
      <DataState isPending={report.isPending} error={report.error} isEmpty={false} empty={null} onRetry={() => report.refetch()}>
        {d && (
          <div className="flex flex-col gap-4 p-4">
            <div className="flex flex-wrap gap-3">
              <MetricCard label="Sheets issued after planned date" value={d.issued_late.pct === null ? "—" : `${d.issued_late.pct}%`} hint={`${d.issued_late.late} of ${d.issued_late.sheets} first issues`} />
              <MetricCard label="Average working days in check" value={d.days_in_check.average ?? "—"} hint={`${d.days_in_check.checks} checks decided`} />
              <MetricCard label="Days from deliverables issued to invoice" value={d.invoice_lag.average_days ?? "—"} hint={`${d.invoice_lag.stages} stages invoiced`} />
            </div>
            <div>
              <h3 className="mb-2 text-body font-semibold">Hours logged vs planned per project</h3>
              {d.hours_vs_planned.length === 0 ? (
                <EmptyState message="No hours planned or logged in this period." />
              ) : (
                <table className={tableClass}>
                  <thead>
                    <tr>
                      <th scope="col" className={thClass}>Project</th>
                      <th scope="col" className={`${thClass} text-right`}>Planned</th>
                      <th scope="col" className={`${thClass} text-right`}>Logged</th>
                      <th scope="col" className={`${thClass} text-right`}>Logged / planned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.hours_vs_planned.map((h) => (
                      <tr key={h.project.id}>
                        <td className={tdClass}><span className="mono">{h.project.code}</span> {h.project.name}</td>
                        <td className={`${tdClass} text-right tabular`}>{h.planned_h} h</td>
                        <td className={`${tdClass} text-right tabular`}>{h.logged_h} h</td>
                        <td className={`${tdClass} text-right tabular`}>{h.pct === null ? "—" : `${h.pct}%`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <details>
              <summary className="cursor-pointer text-small font-semibold">Definitions</summary>
              <dl className="mt-2 grid gap-2 text-small">
                {Object.entries(d.definitions).map(([k, v]) => (
                  <div key={k}>
                    <dt className="font-semibold">{k.replace(/_/g, " ")}</dt>
                    <dd className="text-muted">{v}</dd>
                  </div>
                ))}
              </dl>
            </details>
          </div>
        )}
      </DataState>
    </Card>
  );
}

function HoursReport({ from, to, totalsOnly }: { from: string; to: string; totalsOnly: boolean }) {
  const [group, setGroup] = useState<Group>("project");
  const report = useHoursReport(from, to, group);
  const rows = report.data?.rows ?? [];
  const utilisation = group === "person" || group === "discipline";
  return (
    <Card
      title="Hours"
      actions={
        <Select aria-label="Group hours by" className="h-8 w-72 text-small" value={group} onChange={(e) => setGroup(e.target.value as Group)}>
          {(Object.keys(GROUPS) as Group[])
            .filter((g) => !totalsOnly || g === "project" || g === "stage")
            .map((g) => <option key={g} value={g}>{GROUPS[g]}</option>)}
        </Select>
      }
    >
      <DataState isPending={report.isPending} error={report.error} isEmpty={rows.length === 0} onRetry={() => report.refetch()} empty={<EmptyState message="No hours in this period." />}>
        <table className={tableClass}>
          <thead>
            <tr>
              <th scope="col" className={thClass}>{utilisation ? (group === "person" ? "Person" : "Discipline") : "Project"}</th>
              <th scope="col" className={`${thClass} text-right`}>{utilisation ? "Available" : "Planned"}</th>
              <th scope="col" className={`${thClass} text-right`}>Logged</th>
              <th scope="col" className={`${thClass} text-right`}>{utilisation ? "Utilisation" : "Logged / planned"}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td className={tdClass}>{r.label}</td>
                <td className={`${tdClass} text-right tabular`}>{(utilisation ? r.available_h : r.planned_h) ?? "—"} h</td>
                <td className={`${tdClass} text-right tabular`}>{r.logged_h} h</td>
                <td className={`${tdClass} text-right tabular`}>{r.pct === null ? "—" : `${r.pct}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataState>
    </Card>
  );
}
