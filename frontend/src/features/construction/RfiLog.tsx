import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, CheckCircle2, CircleDot, MessageSquareReply, Plus } from "lucide-react";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Dialog";
import { FlagPill } from "@/components/ui/FlagPill";
import { Field, TextInput } from "@/components/ui/Field";
import { Card, tableClass, tdClass, thClass } from "@/components/ui/PageHeader";
import { DataState, EmptyState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { useProjectContext } from "@/features/projects/ProjectLayout";
import { api, type Schemas, unwrap } from "@/lib/api/client";
import { useMe } from "@/lib/auth/useMe";
import { formatDate, formatDateTime, todayISO } from "@/lib/format";

import { LinkedSheets, MemberSelect, PARTY, Pill, SheetsPicker, useOpenParam } from "./common";

type Rfi = Schemas["Rfi"];

const STATUS = {
  open: { label: "Open", icon: CircleDot, tone: "in_progress" },
  answered: { label: "Answered", icon: MessageSquareReply, tone: "approved_for_issue" },
  closed: { label: "Closed", icon: CheckCircle2, tone: "issued" },
  void: { label: "Void", icon: Ban, tone: "cancelled" },
} as const;

const key = (projectId: string) => ["projects", projectId, "rfis"] as const;

/** S-20 RFI log (F-30): ball in court, due dates, linked sheets; A-10 reminds before due. */
export function RfiLog() {
  const { project } = useProjectContext();
  const rfis = useQuery({ queryKey: key(project.id), queryFn: () => unwrap(api.GET("/api/v1/projects/{project_pk}/rfis", { params: { path: { project_pk: project.id } } })) });
  const [openId, setOpen] = useOpenParam();
  const [creating, setCreating] = useState(false);
  const rows = rfis.data ?? [];
  const open = rows.find((r) => r.id === openId) ?? null;
  const today = todayISO();
  return (
    <>
      <Card title="RFIs" actions={project.my_permissions.manage_ca && <Button size="sm" variant="primary" icon={<Plus size={14} aria-hidden="true" />} onClick={() => setCreating(true)}>Log RFI</Button>}>
        <DataState isPending={rfis.isPending} error={rfis.error} isEmpty={rows.length === 0} onRetry={() => rfis.refetch()} empty={<EmptyState message="No RFIs yet." />}>
          <div className="overflow-x-auto" role="region" aria-label="RFIs" tabIndex={0}>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th scope="col" className={thClass}>RFI</th>
                  <th scope="col" className={thClass}>Ball in court</th>
                  <th scope="col" className={thClass}>Due</th>
                  <th scope="col" className={thClass}>Assignee</th>
                  <th scope="col" className={thClass}>Sheets</th>
                  <th scope="col" className={thClass}>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const s = STATUS[r.status];
                  const overdue = r.status === "open" && r.due_on < today;
                  return (
                    <tr key={r.id}>
                      <td className={tdClass}>
                        <button type="button" className="text-left hover:underline" onClick={() => setOpen(r.id)}>
                          <span className="mono font-semibold">{r.number.split("-").slice(-2).join("-")}</span> {r.subject}
                        </button>
                      </td>
                      <td className={tdClass}>{PARTY[r.ball_in_court ?? ""]}</td>
                      <td className={`${tdClass} tabular`}>{formatDate(r.due_on)} {overdue && <FlagPill kind="late" text="Overdue" />}</td>
                      <td className={tdClass}>{r.assignee_detail?.short_name ?? "—"}</td>
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
      {creating && <NewRfi onClose={() => setCreating(false)} />}
      {open && <RfiDrawer key={open.id} rfi={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function NewRfi({ onClose }: { onClose: () => void }) {
  const { project } = useProjectContext();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({ subject: "", question: "", raised_by_name: "", received_on: todayISO(), due_on: "", assignee: "" });
  const [sheets, setSheets] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const create = useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/projects/{project_pk}/rfis", { params: { path: { project_pk: project.id } }, body: { ...form, assignee: form.assignee || null, sheets } as Schemas["RfiRequest"] })),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: key(project.id) });
      toast({ title: `${r.number} logged` });
      onClose();
    },
    onError: (e) => setError(e.message),
  });
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(undefined);
    create.mutate();
  };
  return (
    <Drawer open onOpenChange={(o) => !o && onClose()} title="Log RFI">
      <form className="flex flex-col gap-3" onSubmit={submit}>
        <Field label="Subject">{(p) => <TextInput {...p} required maxLength={300} value={form.subject} onChange={set("subject")} />}</Field>
        <Field label="Question">{(p) => <textarea {...p} required rows={4} className="rounded-sm border border-border bg-surface p-2 text-body" value={form.question} onChange={set("question")} />}</Field>
        <Field label="Raised by" hint="Contractor contact as named on the RFI.">{(p) => <TextInput {...p} value={form.raised_by_name} onChange={set("raised_by_name")} />}</Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Received">{(p) => <TextInput {...p} type="date" required value={form.received_on} onChange={set("received_on")} />}</Field>
          <Field label="Response due">{(p) => <TextInput {...p} type="date" required min={form.received_on} value={form.due_on} onChange={set("due_on")} />}</Field>
        </div>
        <Field label="Assignee">{(p) => <MemberSelect {...p} value={form.assignee} onChange={(v) => setForm({ ...form, assignee: v })} />}</Field>
        <SheetsPicker value={sheets} onChange={setSheets} />
        {error && <p role="alert" className="text-small text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" busy={create.isPending}>Log RFI</Button>
        </div>
      </form>
    </Drawer>
  );
}

function RfiDrawer({ rfi, onClose }: { rfi: Rfi; onClose: () => void }) {
  const { project } = useProjectContext();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [response, setResponse] = useState("");
  const [revise, setRevise] = useState<string[]>([]);
  const [voidReason, setVoidReason] = useState("");
  const [error, setError] = useState<string>();
  const refresh = () => queryClient.invalidateQueries({ queryKey: key(project.id) });
  const respond = useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/rfis/{id}/respond", { params: { path: { id: rfi.id } }, body: { response, revise_sheets: revise } })),
    onSuccess: (r) => {
      refresh();
      toast({ title: `${rfi.number} answered`, description: [r.revisions_started.length ? `Next revision started: ${r.revisions_started.join(", ")}` : "", r.skipped.join("; ")].filter(Boolean).join(". ") || undefined });
    },
    onError: (e) => setError(e.message),
  });
  const close = useMutation({
    mutationFn: (v: boolean) => unwrap(api.POST("/api/v1/rfis/{id}/close", { params: { path: { id: rfi.id } }, body: { void: v, reason: voidReason } })),
    onSuccess: () => {
      refresh();
      onClose();
    },
    onError: (e) => setError(e.message),
  });
  const me = useMe().data;
  const canAnswer = rfi.status === "open" && (!!project.my_permissions.manage_ca || (!!me && rfi.assignee_detail?.id === me.id));
  return (
    <Drawer open onOpenChange={(o) => !o && onClose()} title={rfi.number}>
      <div className="flex flex-col gap-3 text-body">
        <h3 className="font-semibold">{rfi.subject}</h3>
        <p className="whitespace-pre-wrap">{rfi.question}</p>
        <p className="text-small text-muted">
          Received {formatDate(rfi.received_on)}{rfi.raised_by_name && ` from ${rfi.raised_by_name}`} · due {formatDate(rfi.due_on)} · ball in court: {PARTY[rfi.ball_in_court ?? ""]}
        </p>
        <LinkedSheets refs={rfi.sheet_refs} />
        {rfi.attachment_links.map((a) => <a key={a.id} className="text-primary underline" href={a.url} target="_blank" rel="noopener noreferrer">{a.name}</a>)}
        {rfi.response && (
          <div className="rounded-md border border-border p-3">
            <p className="text-small text-muted">Answer by {rfi.responded_by_detail?.short_name} on {formatDateTime(rfi.responded_at)}</p>
            <p className="whitespace-pre-wrap">{rfi.response}</p>
          </div>
        )}
        {error && <p role="alert" className="text-small text-danger">{error}</p>}
        {canAnswer && (
          <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); setError(undefined); respond.mutate(); }}>
            <Field label="Answer">{(p) => <textarea {...p} required rows={4} className="rounded-sm border border-border bg-surface p-2" value={response} onChange={(e) => setResponse(e.target.value)} />}</Field>
            <SheetsPicker label="Start next revision of" value={revise} onChange={setRevise} />
            <Button type="submit" variant="primary" className="self-end" busy={respond.isPending}>Send answer</Button>
          </form>
        )}
        {project.my_permissions.manage_ca && rfi.status === "answered" && <Button className="self-end" busy={close.isPending} onClick={() => close.mutate(false)}>Close RFI</Button>}
        {project.my_permissions.manage_ca && rfi.status === "open" && (
          <div className="flex items-end gap-2 border-t border-border pt-3">
            <Field label="Void reason" className="flex-1">{(p) => <TextInput {...p} value={voidReason} onChange={(e) => setVoidReason(e.target.value)} />}</Field>
            <Button variant="danger" disabled={!voidReason.trim()} onClick={() => close.mutate(true)}>Void</Button>
          </div>
        )}
      </div>
    </Drawer>
  );
}
