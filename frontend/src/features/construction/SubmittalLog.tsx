import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, CheckCircle2, Clock, Plus, Undo2, XCircle } from "lucide-react";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Dialog";
import { Field, Select, TextInput } from "@/components/ui/Field";
import { Card, tableClass, tdClass, thClass } from "@/components/ui/PageHeader";
import { DataState, EmptyState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { useProjectContext } from "@/features/projects/ProjectLayout";
import { api, type Schemas, unwrap } from "@/lib/api/client";
import { formatDate, formatDateTime, todayISO } from "@/lib/format";
import { uploadFile } from "@/lib/upload";

import { LinkedSheets, MemberSelect, PARTY, Pill, SheetsPicker, useOpenParam } from "./common";

type Submittal = Schemas["Submittal"];

export const SUBMITTAL_STATUS = {
  pending: { label: "Waiting for review", icon: Clock, tone: "in_check" },
  approved: { label: "Approved", icon: CheckCircle2, tone: "issued" },
  approved_as_noted: { label: "Approved as noted", icon: BadgeCheck, tone: "approved_for_issue" },
  revise_resubmit: { label: "Revise and resubmit", icon: Undo2, tone: "changes_requested" },
  rejected: { label: "Rejected", icon: XCircle, tone: "cancelled" },
} as const;

const KINDS: Record<Schemas["SubmittalKindEnum"], string> = {
  shop_drawing: "Shop drawing",
  product_data: "Product data",
  sample: "Sample",
  other: "Other",
};

const key = (projectId: string) => ["projects", projectId, "submittals"] as const;

/** S-20 submittal log (F-31): reviewer stamps the PDF; the log shows who owes the next action. */
export function SubmittalLog() {
  const { project } = useProjectContext();
  const subs = useQuery({ queryKey: key(project.id), queryFn: () => unwrap(api.GET("/api/v1/projects/{project_pk}/submittals", { params: { path: { project_pk: project.id } } })) });
  const [openId, setOpen] = useOpenParam();
  const [creating, setCreating] = useState(false);
  const rows = subs.data ?? [];
  const open = rows.find((r) => r.id === openId) ?? null;
  return (
    <>
      <Card title="Submittals" actions={project.my_permissions.manage_ca && <Button size="sm" variant="primary" icon={<Plus size={14} aria-hidden="true" />} onClick={() => setCreating(true)}>Log submittal</Button>}>
        <DataState isPending={subs.isPending} error={subs.error} isEmpty={rows.length === 0} onRetry={() => subs.refetch()} empty={<EmptyState message="No submittals yet." />}>
          <div className="overflow-x-auto" role="region" aria-label="Submittals" tabIndex={0}>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th scope="col" className={thClass}>Submittal</th>
                  <th scope="col" className={thClass}>Type</th>
                  <th scope="col" className={thClass}>Round</th>
                  <th scope="col" className={thClass}>Next action</th>
                  <th scope="col" className={thClass}>Reviewer</th>
                  <th scope="col" className={thClass}>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const s = SUBMITTAL_STATUS[r.status];
                  return (
                    <tr key={r.id}>
                      <td className={tdClass}>
                        <button type="button" className="text-left hover:underline" onClick={() => setOpen(r.id)}>
                          <span className="mono font-semibold">{r.number.split("-").slice(-2).join("-")}</span> {r.title}
                        </button>
                      </td>
                      <td className={tdClass}>{KINDS[r.kind]}</td>
                      <td className={`${tdClass} tabular`}>{r.round}</td>
                      <td className={tdClass}>{r.ball_in_court ? PARTY[r.ball_in_court] : "Closed"}</td>
                      <td className={tdClass}>{r.reviewer_detail?.short_name ?? "—"}</td>
                      <td className={tdClass}><Pill label={s.label} icon={s.icon} tone={s.tone} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DataState>
      </Card>
      {creating && <NewSubmittal onClose={() => setCreating(false)} />}
      {open && <SubmittalDrawer key={`${open.id}-${open.round}-${open.status}`} sub={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function NewSubmittal({ onClose }: { onClose: () => void }) {
  const { project } = useProjectContext();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({ title: "", kind: "shop_drawing" as Schemas["SubmittalKindEnum"], spec_section: "", submitted_by_name: "", received_on: todayISO(), due_on: "", reviewer: "" });
  const [sheets, setSheets] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string>();
  const create = useMutation({
    mutationFn: async () => {
      const upload = await uploadFile(file!, "document");
      return unwrap(api.POST("/api/v1/projects/{project_pk}/submittals", {
        params: { path: { project_pk: project.id } },
        body: { ...form, due_on: form.due_on || null, reviewer: form.reviewer || null, sheets, file_upload: upload.id } as Schemas["SubmittalRequest"],
      }));
    },
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
    if (!file) return setError("Attach the submittal PDF.");
    create.mutate();
  };
  return (
    <Drawer open onOpenChange={(o) => !o && onClose()} title="Log submittal">
      <form className="flex flex-col gap-3" onSubmit={submit}>
        <Field label="Title">{(p) => <TextInput {...p} required maxLength={300} value={form.title} onChange={set("title")} />}</Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">{(p) => <Select {...p} value={form.kind} onChange={set("kind")}>{Object.entries(KINDS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>}</Field>
          <Field label="Spec section">{(p) => <TextInput {...p} value={form.spec_section} onChange={set("spec_section")} />}</Field>
        </div>
        <Field label="Submitted by">{(p) => <TextInput {...p} value={form.submitted_by_name} onChange={set("submitted_by_name")} />}</Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Received">{(p) => <TextInput {...p} type="date" required value={form.received_on} onChange={set("received_on")} />}</Field>
          <Field label="Review due">{(p) => <TextInput {...p} type="date" min={form.received_on} value={form.due_on} onChange={set("due_on")} />}</Field>
        </div>
        <Field label="Reviewer" hint="A project lead, discipline lead or senior reviewer.">{(p) => <MemberSelect {...p} value={form.reviewer} onChange={(v) => setForm({ ...form, reviewer: v })} />}</Field>
        <Field label="Submittal PDF">{(p) => <input {...p} type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />}</Field>
        <SheetsPicker value={sheets} onChange={setSheets} />
        {error && <p role="alert" className="text-small text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" busy={create.isPending}>Log submittal</Button>
        </div>
      </form>
    </Drawer>
  );
}

function SubmittalDrawer({ sub, onClose }: { sub: Submittal; onClose: () => void }) {
  const { project } = useProjectContext();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [status, setStatus] = useState<Schemas["ReviewSubmittalRequest"]["status"]>("approved");
  const [comment, setComment] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string>();
  const refresh = () => queryClient.invalidateQueries({ queryKey: key(project.id) });
  const review = useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/submittals/{id}/review", { params: { path: { id: sub.id } }, body: { status, comment } })),
    onSuccess: (r) => {
      refresh();
      toast({ title: `${r.number}: ${SUBMITTAL_STATUS[r.status].label}`, description: "The stamped PDF is ready." });
    },
    onError: (e) => setError(e.message),
  });
  const resubmit = useMutation({
    mutationFn: async () => {
      const upload = await uploadFile(file!, "document");
      return unwrap(api.POST("/api/v1/submittals/{id}/resubmit", { params: { path: { id: sub.id } }, body: { file_upload: upload.id } }));
    },
    onSuccess: (r) => {
      refresh();
      toast({ title: `${r.number} round ${r.round} received` });
    },
    onError: (e) => setError(e.message),
  });
  const s = SUBMITTAL_STATUS[sub.status];
  return (
    <Drawer open onOpenChange={(o) => !o && onClose()} title={`${sub.number} · round ${sub.round}`}>
      <div className="flex flex-col gap-3 text-body">
        <h3 className="font-semibold">{sub.title}</h3>
        <Pill label={s.label} icon={s.icon} tone={s.tone} />
        <p className="text-small text-muted">
          {KINDS[sub.kind]}{sub.spec_section && ` · ${sub.spec_section}`} · received {formatDate(sub.received_on)}{sub.submitted_by_name && ` from ${sub.submitted_by_name}`}
        </p>
        <LinkedSheets refs={sub.sheet_refs} />
        <div className="flex flex-wrap gap-3">
          {sub.file_link && <a className="text-primary underline" href={sub.file_link.url} target="_blank" rel="noopener noreferrer">Submitted PDF</a>}
          {sub.stamped_link && <a className="text-primary underline" href={sub.stamped_link.url} target="_blank" rel="noopener noreferrer">Stamped PDF</a>}
        </div>
        {sub.review_comment && (
          <div className="rounded-md border border-border p-3">
            <p className="text-small text-muted">Reviewed by {sub.reviewed_by_detail?.short_name} on {formatDateTime(sub.reviewed_at)}</p>
            <p className="whitespace-pre-wrap">{sub.review_comment}</p>
          </div>
        )}
        {error && <p role="alert" className="text-small text-danger">{error}</p>}
        {project.my_permissions.review_submittal && sub.status === "pending" && (
          <form className="flex flex-col gap-2 border-t border-border pt-3" onSubmit={(e) => { e.preventDefault(); setError(undefined); review.mutate(); }}>
            <Field label="Review status">
              {(p) => (
                <Select {...p} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
                  {(["approved", "approved_as_noted", "revise_resubmit", "rejected"] as const).map((v) => <option key={v} value={v}>{SUBMITTAL_STATUS[v].label}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Comment" hint={status === "approved" ? "Optional." : "Required: say what to change or note."}>
              {(p) => <textarea {...p} rows={3} className="rounded-sm border border-border bg-surface p-2" value={comment} onChange={(e) => setComment(e.target.value)} />}
            </Field>
            <Button type="submit" variant="primary" className="self-end" busy={review.isPending}>Stamp and return</Button>
          </form>
        )}
        {project.my_permissions.manage_ca && (sub.status === "revise_resubmit" || sub.status === "rejected") && (
          <form className="flex flex-col gap-2 border-t border-border pt-3" onSubmit={(e) => { e.preventDefault(); if (file) resubmit.mutate(); }}>
            <Field label="Resubmitted PDF">{(p) => <input {...p} type="file" accept="application/pdf" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} />}</Field>
            <Button type="submit" className="self-end" busy={resubmit.isPending}>Record resubmission</Button>
          </form>
        )}
      </div>
    </Drawer>
  );
}
