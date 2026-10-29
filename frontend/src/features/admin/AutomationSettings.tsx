import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/Field";
import { Card, PageHeader, tableClass, tdClass, thClass } from "@/components/ui/PageHeader";
import { DataState, EmptyState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { api, type Schemas, unwrap } from "@/lib/api/client";
import { formatDateTime } from "@/lib/format";

type Rule = Schemas["AutomationRule"];

const PARAM_LABELS: Record<string, string> = {
  at_risk_working_days: "At risk within (working days)",
  escalate_after_working_days: "Escalate after (working days)",
  over_allocated_pct: "Over-allocated above (%)",
  under_allocated_pct: "Under-allocated below (%)",
  review_open_working_days: "Review open longer than (working days)",
  comment_unanswered_days: "Comment unanswered for (days)",
  rfi_due_working_days: "RFI due within (working days)",
};

/** S-14 Automation thresholds (F-42, 02 §8). Defaults are placeholders to agree with the owner. */
export function AutomationSettings() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const rules = useQuery({ queryKey: ["automation-rules"], queryFn: () => unwrap(api.GET("/api/v1/automation-rules")) });
  const runs = useQuery({ queryKey: ["automation-runs"], queryFn: () => unwrap(api.GET("/api/v1/automation-runs", { params: { query: { page_size: 20 } } })) });
  const save = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Schemas["PatchedAutomationRuleRequest"] }) =>
      unwrap(api.PATCH("/api/v1/automation-rules/{id}", { params: { path: { id } }, body })),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["automation-rules"] });
      toast({ title: `${r.key} saved` });
    },
    onError: (e) => toast({ title: "Not saved", description: e.message }),
  });
  const run = useMutation({
    mutationFn: (id: string) => unwrap(api.POST("/api/v1/automation-rules/{id}/run", { params: { path: { id } } })),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["automation-runs"] });
      toast({ title: `${r.rule}: ${r.raised} raised, ${r.cleared} cleared`, description: r.error || undefined });
    },
  });
  const list = rules.data ?? [];
  return (
    <>
      <PageHeader title="Automation" meta="Daily and weekly checks that raise flags and send reminders. Times are local to the firm." />
      <div className="flex flex-col gap-4">
        <Card>
          <DataState isPending={rules.isPending} error={rules.error} isEmpty={list.length === 0} onRetry={() => rules.refetch()} empty={<EmptyState message="No rules." />}>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th scope="col" className={thClass}>Rule</th>
                  <th scope="col" className={thClass}>When</th>
                  <th scope="col" className={thClass}>Settings</th>
                  <th scope="col" className={thClass}>On</th>
                  <th scope="col" className={thClass}><span className="sr-only">Run</span></th>
                </tr>
              </thead>
              <tbody>{list.map((r) => <RuleRow key={r.id} rule={r} onSave={(body) => save.mutate({ id: r.id, body })} onRun={() => run.mutate(r.id)} running={run.isPending && run.variables === r.id} />)}</tbody>
            </table>
          </DataState>
        </Card>
        <Card title="Recent runs">
          <DataState isPending={runs.isPending} error={runs.error} isEmpty={(runs.data?.results ?? []).length === 0} empty={<EmptyState message="No runs yet. The first sweep runs at 08:00." />}>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th scope="col" className={thClass}>Rule</th>
                  <th scope="col" className={thClass}>Started</th>
                  <th scope="col" className={`${thClass} text-right`}>Raised</th>
                  <th scope="col" className={`${thClass} text-right`}>Cleared</th>
                  <th scope="col" className={`${thClass} text-right`}>Notified</th>
                  <th scope="col" className={thClass}>Result</th>
                </tr>
              </thead>
              <tbody>
                {(runs.data?.results ?? []).map((r) => (
                  <tr key={r.id}>
                    <td className={tdClass}><span className="mono">{r.rule}</span></td>
                    <td className={tdClass}>{formatDateTime(r.started_at)}</td>
                    <td className={`${tdClass} text-right tabular`}>{r.raised}</td>
                    <td className={`${tdClass} text-right tabular`}>{r.cleared}</td>
                    <td className={`${tdClass} text-right tabular`}>{r.notified}</td>
                    <td className={tdClass}>{r.error ? <span style={{ color: "var(--flag-late-fg)" }}>Failed</span> : "OK"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataState>
        </Card>
      </div>
    </>
  );
}

function RuleRow({ rule, onSave, onRun, running }: { rule: Rule; onSave: (b: Schemas["PatchedAutomationRuleRequest"]) => void; onRun: () => void; running: boolean }) {
  const params = (rule.params ?? {}) as Record<string, unknown>;
  const numeric = Object.entries(params).filter(([, v]) => typeof v === "number");
  return (
    <tr>
      <td className={tdClass}><span className="mono font-semibold">{rule.key}</span> {rule.label}</td>
      <td className={`${tdClass} text-small`}>{rule.schedule}</td>
      <td className={tdClass}>
        <div className="flex flex-wrap gap-3">
          {numeric.map(([k, v]) => (
            <label key={k} className="flex items-center gap-2 text-small">
              {PARAM_LABELS[k] ?? k}
              <TextInput
                type="number"
                min={0}
                className="h-8 w-20"
                defaultValue={String(v)}
                onBlur={(e) => Number(e.target.value) !== v && onSave({ params: { ...params, [k]: Number(e.target.value) } })}
              />
            </label>
          ))}
          {numeric.length === 0 && <span className="text-small text-muted">—</span>}
        </div>
      </td>
      <td className={tdClass}><input type="checkbox" aria-label={`${rule.key} enabled`} checked={!!rule.enabled} onChange={(e) => onSave({ enabled: e.target.checked })} /></td>
      <td className={`${tdClass} text-right`}>{["A-01", "A-02", "A-05", "A-06"].includes(rule.key) && <Button size="sm" busy={running} onClick={onRun}>Run now</Button>}</td>
    </tr>
  );
}
