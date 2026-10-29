import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";

import { Card, tableClass, tdClass, thClass } from "@/components/ui/PageHeader";
import { isoWeek } from "@/features/people/api";
import { api, unwrap } from "@/lib/api/client";

import { gateText, useIntelligenceStatus } from "./api";

/** F-56: forecast hours per discipline for 8 weeks, beside (never replacing) the allocations. */
export function WorkloadForecastCard() {
  const status = useIntelligenceStatus();
  const forecast = useQuery({ queryKey: ["intelligence", "workload"], queryFn: () => unwrap(api.GET("/api/v1/intelligence/workload")) });
  const rows = forecast.data ?? [];
  const weeks = [...new Set(rows.map((r) => r.week))].sort();
  const codes = [...new Set(rows.map((r) => r.discipline_code))].sort();
  const cell = (code: string, week: string) => rows.find((r) => r.discipline_code === code && r.week === week);
  const metrics = (status.data?.runs.workload?.metrics ?? {}) as { mape_model?: number | null; mape_baseline?: number | null };
  return (
    <Card title="Forecast: hours per discipline">
      <div className="flex flex-col gap-2 p-4">
        <p className="flex items-center gap-1.5 text-small text-muted">
          <Sparkles size={14} aria-hidden="true" /> Advisory. Compare it with planned allocations; it never changes them.
          {metrics.mape_model != null && ` Typical error ${metrics.mape_model}% (baseline ${metrics.mape_baseline ?? "—"}%).`}
        </p>
        {rows.length === 0 ? (
          <p className="text-body text-muted">{status.data && !status.data.gate.met ? gateText(status.data.gate) : "No forecast yet."}</p>
        ) : (
          <div className="overflow-x-auto" role="region" aria-label="Workload forecast" tabIndex={0}>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th scope="col" className={thClass}>Discipline</th>
                  {weeks.map((w) => <th key={w} scope="col" className={`${thClass} text-right`}>W{isoWeek(w)}</th>)}
                </tr>
              </thead>
              <tbody>
                {codes.map((c) => (
                  <tr key={c}>
                    <th scope="row" className={`${tdClass} font-semibold`}>{c}</th>
                    {weeks.map((w) => <td key={w} className={`${tdClass} text-right tabular`}>{cell(c, w)?.hours ?? "—"} h</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}
