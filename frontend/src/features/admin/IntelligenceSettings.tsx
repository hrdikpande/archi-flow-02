import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/Button";
import { Card, PageHeader, tableClass, tdClass, thClass } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { gateText, useIntelligenceStatus } from "@/features/intelligence/api";
import { api, unwrap } from "@/lib/api/client";
import { formatDateTime } from "@/lib/format";

/** Admin › Intelligence (P4): gate G3, model back-tests, drawing-check rollout. */
export function IntelligenceSettings() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const status = useIntelligenceStatus();
  const evaluation = useQuery({ queryKey: ["intelligence", "evaluation"], queryFn: () => unwrap(api.GET("/api/v1/intelligence/findings/evaluation")) });
  const setMode = useMutation({
    mutationFn: (mode: "off" | "evaluation" | "on") => unwrap(api.PUT("/api/v1/intelligence/findings/evaluation", { body: { mode } })),
    onSuccess: (d) => {
      queryClient.setQueryData(["intelligence", "evaluation"], d);
      toast({ title: `Drawing checks: ${d.mode}` });
    },
    onError: (e) => toast({ title: "Not changed", description: e.message }),
  });
  const run = useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/intelligence/run")),
    onSuccess: () => toast({ title: "Weekly job queued", description: "Results appear here in a few minutes." }),
  });
  const g = status.data?.gate;
  const ev = evaluation.data;
  return (
    <>
      <PageHeader title="Intelligence" meta="Advisory forecasts and drawing checks (Phase 4). Nothing here changes project data." />
      <div className="flex flex-col gap-4">
        <Card title="Gate G3" actions={<Button size="sm" busy={run.isPending} onClick={() => run.mutate()}>Run weekly job now</Button>}>
          <p className="p-4 text-body">{g ? (g.met ? `Met: ${g.months} months of history, ${g.cycles.toLocaleString("en-IN")} issued sheets.` : gateText(g)) : "…"}</p>
        </Card>
        <Card title="Latest model runs">
          <table className={tableClass}>
            <thead><tr><th scope="col" className={thClass}>Model</th><th scope="col" className={thClass}>Status</th><th scope="col" className={thClass}>When</th><th scope="col" className={thClass}>Back-test</th></tr></thead>
            <tbody>
              {Object.entries(status.data?.runs ?? {}).map(([kind, r]) => {
                const m = r.metrics as Record<string, unknown>;
                const result = kind === "late_risk"
                  ? (m.mean_lift != null ? `Top-20% lift over A-01: ${m.mean_lift}× (target ${m.target_lift}×)` : "—")
                  : (m.mape_model != null ? `MAPE ${m.mape_model}% (baseline ${m.mape_baseline}%)` : "—");
                return (
                  <tr key={kind}>
                    <td className={tdClass}>{kind === "late_risk" ? "Late-risk (F-55)" : "Workload (F-56)"}</td>
                    <td className={tdClass}>{r.status}{r.forced && " (evaluation)"}{r.note && <span className="block text-small text-muted">{r.note}</span>}</td>
                    <td className={tdClass}>{formatDateTime(r.created_at)}</td>
                    <td className={tdClass}>{result}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
        <Card title="Drawing checks (F-57)">
          <div className="flex flex-col gap-3 p-4 text-body">
            <p>Rule checks on issued PDFs: title-block fields and references to sheets that are missing or not issued. Advisory; never blocks an issue. No drawing is sent outside the firm.</p>
            {ev && (
              <>
                <p>Mode: <strong>{ev.mode}</strong> · labelled sheets {ev.labelled_sheets} of {ev.needed_sheets} needed · precision {ev.precision != null ? `${Math.round(ev.precision * 100)}%` : "—"}</p>
                <ul className="text-small">{ev.rules.map((r) => <li key={r.rule}><span className="mono">{r.rule}</span>: {r.accepted} correct, {r.rejected} false alarms, {r.open} open</li>)}</ul>
              </>
            )}
            <div className="flex flex-wrap gap-2">
              {(["off", "evaluation", "on"] as const).map((m) => (
                <Button key={m} variant={ev?.mode === m ? "primary" : "secondary"} busy={setMode.isPending && setMode.variables === m} onClick={() => setMode.mutate(m)}>
                  {m === "off" ? "Off" : m === "evaluation" ? "Evaluate (leads label findings)" : "On for everyone"}
                </Button>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
