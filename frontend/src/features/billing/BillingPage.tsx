import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, ReceiptIndianRupee } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Field, TextInput } from "@/components/ui/Field";
import { MetricCard } from "@/components/ui/MetricCard";
import { Card, PageHeader, tableClass, tdClass, thClass } from "@/components/ui/PageHeader";
import { SubNav } from "@/components/ui/SubNav";
import { DataState, EmptyState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { api, type Schemas, unwrap } from "@/lib/api/client";
import type { Me } from "@/lib/auth/useMe";
import { formatDate, formatINR } from "@/lib/format";

type Signal = Schemas["BillingSignal"];

/** S-17 billing signals (F-27, F-28): stages ready to invoice; Accounts mark them invoiced. */
export function BillingPage({ me, state }: { me: Me; state: "ready" | "invoiced" }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const signals = useQuery({
    queryKey: ["billing", state],
    queryFn: () => unwrap(api.GET("/api/v1/billing/signals", { params: { query: { state } } })),
  });
  const [marking, setMarking] = useState<Signal | null>(null);
  const [ref, setRef] = useState("");
  const mark = useMutation({
    mutationFn: (s: Signal) => unwrap(api.POST("/api/v1/billing/signals/{id}/invoiced", { params: { path: { id: s.id } }, body: { invoice_ref: ref } })),
    onSuccess: (s) => {
      queryClient.invalidateQueries({ queryKey: ["billing"] });
      toast({ title: `${s.project_code} ${s.stage_name} marked invoiced` });
      setMarking(null);
      setRef("");
    },
    onError: (e) => toast({ title: "Not marked", description: e.message }),
  });
  const rows = signals.data ?? [];
  const amount = rows.reduce((t, s) => t + Number(s.fee_amount ?? 0), 0);
  const canMark = me.capabilities.mark_invoiced;

  return (
    <>
      <PageHeader
        title="Billing"
        meta="A stage is ready to invoice when all its deliverables are issued and the client's approval is recorded. Invoicing itself stays in your accounting tool."
        actions={
          state === "ready" && rows.length > 0 && (
            <a className="inline-flex h-9 items-center gap-2 rounded-sm border border-border bg-surface px-3 text-body hover:bg-surface-muted" href="/api/v1/billing/signals/export" download>
              <Download size={16} aria-hidden="true" /> Export CSV
            </a>
          )
        }
      />
      <SubNav label="Billing" items={[{ to: "/billing", label: "Ready to invoice", end: true }, { to: "/billing/invoiced", label: "Invoiced" }]} />
      {state === "ready" && (
        <div className="mb-4 flex flex-wrap gap-3">
          <MetricCard label="Stages ready to invoice" value={rows.length} />
          <MetricCard label="Fee value" value={formatINR(amount) || "₹0"} hint="where a fee amount is entered" />
          <MetricCard label="Oldest waiting" value={rows.length ? `${Math.max(...rows.map((r) => r.days_waiting))} days` : "—"} />
        </div>
      )}
      <Card>
        <DataState isPending={signals.isPending} error={signals.error} isEmpty={rows.length === 0} onRetry={() => signals.refetch()} empty={<EmptyState message={state === "ready" ? "No stages are waiting to be invoiced." : "Nothing invoiced yet."} />}>
          <div className="overflow-x-auto" role="region" aria-label="Billing signals" tabIndex={0}>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th scope="col" className={thClass}>Project</th>
                  <th scope="col" className={thClass}>Stage</th>
                  <th scope="col" className={`${thClass} text-right`}>Fee %</th>
                  <th scope="col" className={`${thClass} text-right`}>Amount</th>
                  <th scope="col" className={thClass}>Ready since</th>
                  <th scope="col" className={`${thClass} text-right`}>{state === "ready" ? "Days waiting" : "Invoiced"}</th>
                  <th scope="col" className={thClass}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id}>
                    <td className={tdClass}><Link className="hover:underline" to={`/projects/${s.project}/stages`}><span className="mono">{s.project_code}</span> {s.project_name}</Link>{s.client && <span className="block text-small text-muted">{s.client}</span>}</td>
                    <td className={tdClass}>{s.stage_seq}. {s.stage_name}</td>
                    <td className={`${tdClass} text-right tabular`}>{s.fee_pct}%</td>
                    <td className={`${tdClass} text-right tabular`}>{s.fee_amount ? formatINR(s.fee_amount) : "—"}</td>
                    <td className={`${tdClass} tabular`}>{formatDate(s.ready_at)}</td>
                    <td className={`${tdClass} text-right tabular`}>{state === "ready" ? s.days_waiting : `${formatDate(s.invoiced_at)}${s.invoice_ref ? ` · ${s.invoice_ref}` : ""}`}</td>
                    <td className={`${tdClass} text-right`}>
                      {state === "ready" && canMark && (
                        <Button size="sm" variant="primary" icon={<ReceiptIndianRupee size={14} aria-hidden="true" />} onClick={() => setMarking(s)}>Mark invoiced</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataState>
      </Card>
      <ConfirmDialog
        open={!!marking}
        onOpenChange={(o) => !o && setMarking(null)}
        title={`Mark ${marking?.project_code} ${marking?.stage_name} invoiced?`}
        confirmLabel="Mark invoiced"
        busy={mark.isPending}
        onConfirm={() => marking && mark.mutate(marking)}
      >
        <p className="mb-3">The stage moves to Invoiced and leaves this list.</p>
        <Field label="Invoice number (optional)">{(p) => <TextInput {...p} value={ref} maxLength={100} onChange={(e) => setRef(e.target.value)} />}</Field>
      </ConfirmDialog>
    </>
  );
}
