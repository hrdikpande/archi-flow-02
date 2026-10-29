import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleDot, Plus, Wrench, XCircle } from "lucide-react";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Dialog";
import { Field, Select, TextInput } from "@/components/ui/Field";
import { Card, tableClass, tdClass, thClass } from "@/components/ui/PageHeader";
import { DataState, EmptyState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { useProjectContext } from "@/features/projects/ProjectLayout";
import { api, type Schemas, unwrap } from "@/lib/api/client";
import { formatDateTime, formatINR } from "@/lib/format";

import { LinkedSheets, Pill, SheetsPicker, useOpenParam } from "./common";

type ChangeOrder = Schemas["ChangeOrder"];

const STATUS = {
  proposed: { label: "Proposed", icon: CircleDot, tone: "in_check" },
  approved: { label: "Approved", icon: CheckCircle2, tone: "approved_for_issue" },
  rejected: { label: "Rejected", icon: XCircle, tone: "cancelled" },
  implemented: { label: "Implemented", icon: Wrench, tone: "issued" },
} as const;

const ORIGINS: Record<Schemas["ChangeOriginEnum"], string> = {
  rfi: "RFI", client: "Client request", site: "Site condition", design: "Design development", other: "Other",
};

const key = (projectId: string) => ["projects", projectId, "change-orders"] as const;

/** S-20 change-order log (F-33): approval by the PL; can start a new revision cycle. */
export function ChangeOrders() {
  const { project } = useProjectContext();
  const orders = useQuery({ queryKey: key(project.id), queryFn: () => unwrap(api.GET("/api/v1/projects/{project_pk}/change-orders", { params: { path: { project_pk: project.id } } })) });
  const [openId, setOpen] = useOpenParam();
  const [creating, setCreating] = useState(false);
  const rows = orders.data ?? [];
  const open = rows.find((r) => r.id === openId) ?? null;
  return (
    <>
      <Card title="Change orders" actions={project.my_permissions.manage_ca && <Button size="sm" variant="primary" icon={<Plus size={14} aria-hidden="true" />} onClick={() => setCreating(true)}>Log change</Button>}>
        <DataState isPending={orders.isPending} error={orders.error} isEmpty={rows.length === 0} onRetry={() => orders.refetch()} empty={<EmptyState message="No change orders yet." />}>
          <div className="overflow-x-auto" role="region" aria-label="Change orders" tabIndex={0}>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th scope="col" className={thClass}>Change</th>
                  <th scope="col" className={thClass}>Origin</th>
                  <th scope="col" className={`${thClass} text-right`}>Cost</th>
                  <th scope="col" className={`${thClass} text-right`}>Time</th>
                  <th scope="col" className={thClass}>Sheets</th>
                  <th scope="col" className={thClass}>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const s = STATUS[r.status];
                  return (
                    <tr key={r.id}>
                      <td className={tdClass}>
                        <button type="button" className="text-left hover:underline" onClick={() => setOpen(r.id)}>
                          <span className="mono font-semibold">{r.number.split("-").slice(-2).join("-")}</span> {r.title}
                        </button>
                      </td>
                      <td className={tdClass}>{ORIGINS[r.origin]}{r.rfi_number && <span className="mono text-small text-muted"> {r.rfi_number.split("-").slice(-2).join("-")}</span>}</td>
                      <td className={`${tdClass} text-right tabular`}>{r.cost_impact ? formatINR(r.cost_impact) : "—"}</td>
                      <td className={`${tdClass} text-right tabular`}>{r.schedule_impact_days != null ? `${r.schedule_impact_days} d` : "—"}</td>
                      <td className={tdClass}><LinkedSheets refs={r.sheet_refs} /></td>
                      <td className={tdClass}><Pill label={s.label} icon={s.icon} tone={s.tone} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DataState>
      </Card>
      {creating && <NewChange onClose={() => setCreating(false)} />}
      {open && <ChangeDrawer key={`${open.id}-${open.status}`} co={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function NewChange({ onClose }: { onClose: () => void }) {
  const { project } = useProjectContext();
  const queryClient = useQueryClient();
  const toast = useToast();
  const rfis = useQuery({ queryKey: ["projects", project.id, "rfis"], queryFn: () => unwrap(api.GET("/api/v1/projects/{project_pk}/rfis", { params: { path: { project_pk: project.id } } })) });
  const [form, setForm] = useState({ title: "", description: "", origin: "client" as Schemas["ChangeOriginEnum"], rfi: "", cost_impact: "", schedule_impact_days: "" });
  const [sheets, setSheets] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const create = useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/projects/{project_pk}/change-orders", {
      params: { path: { project_pk: project.id } },
      body: { ...form, rfi: form.rfi || null, cost_impact: form.cost_impact || null, schedule_impact_days: form.schedule_impact_days ? Number(form.schedule_impact_days) : null, sheets } as Schemas["ChangeOrderRequest"],
    })),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: key(project.id) });
      toast({ title: `${r.number} logged` });
      onClose();
    },
    onError: (e) => setError(e.message),
  });
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });
  return (
    <Drawer open onOpenChange={(o) => !o && onClose()} title="Log change order">
      <form className="flex flex-col gap-3" onSubmit={(e: FormEvent) => { e.preventDefault(); setError(undefined); create.mutate(); }}>
        <Field label="Title">{(p) => <TextInput {...p} required maxLength={300} value={form.title} onChange={set("title")} />}</Field>
        <Field label="Description">{(p) => <textarea {...p} required rows={4} className="rounded-sm border border-border bg-surface p-2" value={form.description} onChange={set("description")} />}</Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Origin">{(p) => <Select {...p} value={form.origin} onChange={set("origin")}>{Object.entries(ORIGINS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>}</Field>
          <Field label="From RFI">{(p) => <Select {...p} value={form.rfi} onChange={set("rfi")}><option value="">None</option>{rfis.data?.map((r) => <option key={r.id} value={r.id}>{r.number}</option>)}</Select>}</Field>
          <Field label="Cost impact (₹)">{(p) => <TextInput {...p} inputMode="decimal" value={form.cost_impact} onChange={set("cost_impact")} />}</Field>
          <Field label="Time impact (days)">{(p) => <TextInput {...p} inputMode="numeric" value={form.schedule_impact_days} onChange={set("schedule_impact_days")} />}</Field>
        </div>
        <SheetsPicker value={sheets} onChange={setSheets} />
        {error && <p role="alert" className="text-small text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" busy={create.isPending}>Log change</Button>
        </div>
      </form>
    </Drawer>
  );
}

function ChangeDrawer({ co, onClose }: { co: ChangeOrder; onClose: () => void }) {
  const { project } = useProjectContext();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const refresh = () => queryClient.invalidateQueries({ queryKey: key(project.id) });
  const decide = useMutation({
    mutationFn: (approve: boolean) => unwrap(api.POST("/api/v1/change-orders/{id}/decide", { params: { path: { id: co.id } }, body: { approve, note } })),
    onSuccess: (r) => {
      refresh();
      toast({ title: `${r.number} ${STATUS[r.status].label.toLowerCase()}` });
    },
    onError: (e) => setError(e.message),
  });
  const start = useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/change-orders/{id}/start-revisions", { params: { path: { id: co.id } } })),
    onSuccess: (r) => {
      refresh();
      toast({ title: r.revisions_started.length ? `Next revision started: ${r.revisions_started.join(", ")}` : "No issued sheets to revise", description: r.skipped.join("; ") || undefined });
    },
    onError: (e) => setError(e.message),
  });
  const s = STATUS[co.status];
  return (
    <Drawer open onOpenChange={(o) => !o && onClose()} title={co.number}>
      <div className="flex flex-col gap-3 text-body">
        <h3 className="font-semibold">{co.title}</h3>
        <Pill label={s.label} icon={s.icon} tone={s.tone} />
        <p className="whitespace-pre-wrap">{co.description}</p>
        <p className="text-small text-muted">{ORIGINS[co.origin]}{co.rfi_number && ` (${co.rfi_number})`} · cost {co.cost_impact ? formatINR(co.cost_impact) : "—"} · time {co.schedule_impact_days ?? "—"} days</p>
        <LinkedSheets refs={co.sheet_refs} />
        {co.decided_at && <p className="text-small text-muted">Decided by {co.decided_by_detail?.short_name} on {formatDateTime(co.decided_at)}{co.decision_note && `: ${co.decision_note}`}</p>}
        {error && <p role="alert" className="text-small text-danger">{error}</p>}
        {project.my_permissions.approve_change_order && co.status === "proposed" && (
          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <Field label="Decision note" hint="Required to reject.">{(p) => <TextInput {...p} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
            <div className="flex justify-end gap-2">
              <Button onClick={() => decide.mutate(false)} busy={decide.isPending && decide.variables === false}>Reject</Button>
              <Button variant="primary" onClick={() => decide.mutate(true)} busy={decide.isPending && decide.variables === true}>Approve</Button>
            </div>
          </div>
        )}
        {project.my_permissions.manage_ca && co.status === "approved" && (
          <Button variant="primary" className="self-end" busy={start.isPending} onClick={() => start.mutate()}>Start revision cycle</Button>
        )}
      </div>
    </Drawer>
  );
}
