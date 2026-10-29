import { useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatDate } from "@/lib/format";

import { Select } from "./Field";

interface Series {
  discipline: string;
  planned: number[];
  issued: (number | null)[];
  total: number;
}

interface BurnUpChartProps {
  weeks: string[];
  series: Series[];
  today: string;
}

/** Planned vs issued sheets over time per discipline (DESIGN.md §4): planned dashed, issued
 * solid, today marker. The same numbers are offered as a table for screen readers. */
export function BurnUpChart({ weeks, series, today }: BurnUpChartProps) {
  const [discipline, setDiscipline] = useState(series[0]?.discipline ?? "All");
  const [asTable, setAsTable] = useState(false);
  const chosen = series.find((s) => s.discipline === discipline) ?? series[0];
  if (!chosen || weeks.length === 0) return <p className="p-4 text-body text-muted">No planned or issued sheets yet.</p>;
  const data = weeks.map((w, i) => ({ week: w, label: formatDate(w).slice(0, 6), planned: chosen.planned[i], issued: chosen.issued[i] }));
  const todayWeek = [...weeks].reverse().find((w) => w <= today);

  return (
    <div className="p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <Select aria-label="Discipline" className="h-8 w-48 text-small" value={discipline} onChange={(e) => setDiscipline(e.target.value)}>
          {series.map((s) => (
            <option key={s.discipline} value={s.discipline}>
              {s.discipline === "All" ? "All disciplines" : s.discipline} · {s.total} sheets
            </option>
          ))}
        </Select>
        <button type="button" className="text-small text-primary underline" onClick={() => setAsTable(!asTable)}>
          {asTable ? "Show chart" : "Show as table"}
        </button>
      </div>
      {asTable ? (
        <div className="max-h-72 overflow-y-auto" role="region" aria-label="Burn-up data" tabIndex={0}>
          <table className="w-full text-left text-small">
            <thead>
              <tr>
                <th scope="col" className="px-2 py-1">Week of</th>
                <th scope="col" className="px-2 py-1 text-right">Planned (cumulative)</th>
                <th scope="col" className="px-2 py-1 text-right">Issued (cumulative)</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.week} className="border-t border-border">
                  <td className="px-2 py-1">{formatDate(d.week)}</td>
                  <td className="px-2 py-1 text-right tabular">{d.planned}</td>
                  <td className="px-2 py-1 text-right tabular">{d.issued ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-64" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--text-muted)" }} interval="preserveStartEnd" minTickGap={24} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "var(--text-muted)" }} />
              <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {todayWeek && <ReferenceLine x={formatDate(todayWeek).slice(0, 6)} stroke="var(--text-muted)" strokeDasharray="2 2" label={{ value: "Today", fontSize: 11, fill: "var(--text-muted)" }} />}
              <Line type="stepAfter" dataKey="planned" name="Planned" stroke="var(--text-muted)" strokeDasharray="6 4" dot={false} isAnimationActive={false} />
              <Line type="stepAfter" dataKey="issued" name="Issued" stroke="var(--primary)" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="sr-only">
        {chosen.discipline === "All" ? "All disciplines" : chosen.discipline}: {chosen.issued.filter((v) => v !== null).at(-1) ?? 0} of {chosen.total} sheets issued; {chosen.planned.at(-1)} planned by {formatDate(weeks.at(-1))}.
      </p>
    </div>
  );
}
