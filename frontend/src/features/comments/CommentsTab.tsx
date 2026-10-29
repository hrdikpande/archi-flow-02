import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleDot, Copy, Mail, MessageSquareReply, Plus, UserCheck, XCircle } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useSearchParams } from "react-router";

import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Dialog";
import { Field, Select, TextInput } from "@/components/ui/Field";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { Card, tableClass, tdClass, thClass } from "@/components/ui/PageHeader";
import { DataState, EmptyState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { useMembers, useStages } from "@/features/projects/api";
import { useProjectContext } from "@/features/projects/ProjectLayout";
import { useSheets } from "@/features/register/useSheets";
import { api, type Schemas, unwrap } from "@/lib/api/client";
import { formatDate, formatDateTime, todayISO } from "@/lib/format";
import { uploadFile } from "@/lib/upload";

type Comment = Schemas["Comment"];
type Status = Schemas["CommentStatusEnum"];

export const SOURCES: Record<Schemas["CommentSourceEnum"], string> = {
  email: "Email",
  meeting: "Meeting",
  call: "Phone call",
  whatsapp: "WhatsApp",
  letter: "Letter",
  other: "Other",
};

/** Status is colour + icon + word (CLAUDE.md, DESIGN.md §2). */
const STATUS: Record<Status, { label: string; icon: typeof CircleDot; fg: string; bg: string }> = {
  new: { label: "New", icon: CircleDot, fg: "var(--state-in_progress-fg)", bg: "var(--state-in_progress-bg)" },
  assigned: { label: "Assigned", icon: UserCheck, fg: "var(--state-in_check-fg)", bg: "var(--state-in_check-bg)" },
  responded: { label: "Responded", icon: MessageSquareReply, fg: "var(--state-approved_for_issue-fg)", bg: "var(--state-approved_for_issue-bg)" },
  closed: { label: "Closed", icon: CheckCircle2, fg: "var(--state-issued-fg)", bg: "var(--state-issued-bg)" },
  rejected: { label: "Rejected", icon: XCircle, fg: "var(--state-cancelled-fg)", bg: "var(--state-cancelled-bg)" },
};

export function CommentStatusChip({ status }: { status: Status }) {
  const s = STATUS[status];
  const Icon = s.icon;
  return (
    <span className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-small font-semibold whitespace-nowrap" style={{ color: s.fg, background: s.bg }}>
      <Icon size={14} aria-hidden="true" /> {s.label}
    </span>
  );
}

const commentsKey = (projectId: string) => ["projects", projectId, "comments"] as const;

/** S-16 client comments log (F-24, F-25). */
export function CommentsTab() {
  const { project } = useProjectContext();
  const [params, setParams] = useSearchParams();
  const statuses = params.getAll("status");
  const comments = useQuery({
    queryKey: [...commentsKey(project.id), statuses],
    queryFn: () => unwrap(api.GET("/api/v1/projects/{project_pk}/comments", { params: { path: { project_pk: project.id }, query: { status: statuses.length ? statuses : undefined } } })),
  });
  const [logging, setLogging] = useState(false);
  const toast = useToast();
  const openId = params.get("open");
  const open = comments.data?.find((c) => c.id === openId) ?? null;
  const canLog = !!project.my_permissions.log_comments;
  const rows = comments.data ?? [];
  const setOpen = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set("open", id);
    else next.delete("open");
    setParams(next, { replace: true });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-small text-muted">
          <Mail size={14} aria-hidden="true" /> Forward client emails to <span className="mono text-text">{project.inbound_address}</span>
          <button type="button" className="text-primary" aria-label="Copy the project email address" onClick={() => navigator.clipboard?.writeText(project.inbound_address).then(() => toast({ title: "Address copied" }))}>
            <Copy size={14} aria-hidden="true" />
          </button>
        </p>
        <div className="flex items-center gap-2">
          <MultiSelect
            label="Status"
            options={Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label }))}
            value={statuses}
            onChange={(v) => {
              const next = new URLSearchParams(params);
              next.delete("status");
              for (const x of v) next.append("status", x);
              setParams(next, { replace: true });
            }}
          />
          {canLog && <Button variant="primary" icon={<Plus size={14} aria-hidden="true" />} onClick={() => setLogging(true)}>Log comment</Button>}
        </div>
      </div>
      {canLog && <EmailQueue />}
      <Card title="Client comments">
        <DataState isPending={comments.isPending} error={comments.error} isEmpty={rows.length === 0} onRetry={() => comments.refetch()} empty={<EmptyState message="No client comments logged yet." />}>
          <div className="overflow-x-auto" role="region" aria-label="Client comments" tabIndex={0}>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th scope="col" className={thClass}>Comment</th>
                  <th scope="col" className={thClass}>Source</th>
                  <th scope="col" className={thClass}>Received</th>
                  <th scope="col" className={thClass}>From</th>
                  <th scope="col" className={thClass}>Sheets</th>
                  <th scope="col" className={thClass}>Assignee</th>
                  <th scope="col" className={thClass}>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td className={tdClass}>
                      <button type="button" className="text-left hover:underline" onClick={() => setOpen(c.id)}>
                        <span className="mono font-semibold">{c.number.split("-").slice(-2).join("-")}</span> {(c.subject || c.body).slice(0, 80)}
                      </button>
                    </td>
                    <td className={tdClass}>{SOURCES[c.source]}</td>
                    <td className={`${tdClass} tabular`}>{formatDate(c.received_on)}</td>
                    <td className={tdClass}>{c.from_name || "—"}</td>
                    <td className={`${tdClass} mono text-small`}>{c.sheet_refs.map((s) => s.number).join(", ") || "—"}</td>
                    <td className={tdClass}>{c.assignee_detail?.short_name ?? "—"}</td>
                    <td className={tdClass}><CommentStatusChip status={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataState>
      </Card>
      {logging && <LogDrawer onClose={() => setLogging(false)} />}
      {open && <CommentDrawer key={open.id} comment={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function useOptions() {
  const { project } = useProjectContext();
  const sheets = useSheets(project.id);
  const members = useMembers(project.id);
  const stages = useStages(project.id);
  const people = [...new Map((members.data ?? []).map((m) => [m.user.id, m.user])).values()];
  return {
    sheets: (sheets.data ?? []).map((s) => ({ value: s.id, label: `${s.number} ${s.title}` })),
    people,
    stages: stages.data ?? [],
  };
}

function LogDrawer({ onClose }: { onClose: () => void }) {
  const { project } = useProjectContext();
  const queryClient = useQueryClient();
  const toast = useToast();
  const opts = useOptions();
  const [form, setForm] = useState({ source: "meeting" as Schemas["CommentSourceEnum"], received_on: todayISO(), from_name: "", subject: "", body: "", stage: "", assignee: "" });
  const [sheets, setSheets] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const save = useMutation({
    mutationFn: () =>
      unwrap(api.POST("/api/v1/projects/{project_pk}/comments", {
        params: { path: { project_pk: project.id } },
        body: { ...form, stage: form.stage || null, assignee: form.assignee || null, sheets },
      })),
    onSuccess: (c) => {
      queryClient.invalidateQueries({ queryKey: commentsKey(project.id) });
      toast({ title: `${c.number} logged` });
      onClose();
    },
    onError: (e) => setError(e.message),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(undefined);
    save.mutate();
  };
  return (
    <Drawer open onOpenChange={(o) => !o && onClose()} title="Log a client comment">
      <form className="flex flex-col gap-3" onSubmit={submit}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Source">
            {(p) => (
              <Select {...p} value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value as Schemas["CommentSourceEnum"] })}>
                {Object.entries(SOURCES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Received">{(p) => <TextInput {...p} type="date" value={form.received_on} max={todayISO()} onChange={(e) => setForm({ ...form, received_on: e.target.value })} />}</Field>
        </div>
        <Field label="From">{(p) => <TextInput {...p} value={form.from_name} placeholder="Dr Rao, client" onChange={(e) => setForm({ ...form, from_name: e.target.value })} />}</Field>
        <Field label="Comment">{(p) => <textarea {...p} rows={4} required className="w-full rounded-sm border border-border bg-surface p-2 text-body" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />}</Field>
        <div className="flex flex-wrap items-center gap-2">
          <MultiSelect label="Sheets" options={opts.sheets} value={sheets} onChange={setSheets} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Stage">
            {(p) => (
              <Select {...p} value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
                <option value="">—</option>
                {opts.stages.map((s) => <option key={s.id} value={s.id}>{s.seq}. {s.name}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Assign to">
            {(p) => (
              <Select {...p} value={form.assignee} onChange={(e) => setForm({ ...form, assignee: e.target.value })}>
                <option value="">Not yet</option>
                {opts.people.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </Select>
            )}
          </Field>
        </div>
        {error && <p role="alert" className="text-small text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" busy={save.isPending}>Log comment</Button>
        </div>
      </form>
    </Drawer>
  );
}

function CommentDrawer({ comment, onClose }: { comment: Comment; onClose: () => void }) {
  const { project } = useProjectContext();
  const queryClient = useQueryClient();
  const toast = useToast();
  const opts = useOptions();
  const [response, setResponse] = useState(comment.response ?? "");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const done = comment.status === "closed" || comment.status === "rejected";
  const update = useMutation({
    mutationFn: (body: Schemas["PatchedCommentUpdateRequest"]) => unwrap(api.PATCH("/api/v1/comments/{id}", { params: { path: { id: comment.id } }, body })),
    onSuccess: (c, body) => {
      queryClient.invalidateQueries({ queryKey: commentsKey(project.id) });
      toast({ title: `${c.number}: ${body.action ? STATUS[c.status].label.toLowerCase() : "saved"}` });
      setError(undefined);
    },
    onError: (e) => setError(e.message),
  });
  const attach = useMutation({
    mutationFn: async (files: File[]) => {
      const ids = [];
      for (const f of files) ids.push((await uploadFile(f, f.type.startsWith("image/") ? "image" : "document")).id);
      return unwrap(api.POST("/api/v1/comments/{id}/attachments", { params: { path: { id: comment.id } }, body: { upload_ids: ids } }));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: commentsKey(project.id) }),
    onError: (e) => setError(e.message),
  });

  return (
    <Drawer open onOpenChange={(o) => !o && onClose()} title={comment.number}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2 text-small text-muted">
          <CommentStatusChip status={comment.status} /> {SOURCES[comment.source]} · {formatDate(comment.received_on)} · {comment.from_name || "—"}
        </div>
        {comment.subject && <p className="text-body font-semibold">{comment.subject}</p>}
        <p className="text-body whitespace-pre-wrap">{comment.body}</p>
        {comment.attachment_links.length > 0 && (
          <ul className="flex flex-col gap-1 text-small">
            {comment.attachment_links.map((a) => <li key={a.id}><a className="text-primary underline" href={a.url} target="_blank" rel="noopener noreferrer">{a.name}</a></li>)}
          </ul>
        )}
        {comment.email_id && <p className="text-small text-muted">Captured from email to the project address.</p>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Assignee">
            {(p) => (
              <Select {...p} value={comment.assignee ?? ""} disabled={done} onChange={(e) => update.mutate({ assignee: e.target.value || null })}>
                <option value="">Not assigned</option>
                {opts.people.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </Select>
            )}
          </Field>
          <div className="flex items-end">
            <MultiSelect label="Sheets" options={opts.sheets} value={comment.sheets ?? []} onChange={(v) => update.mutate({ sheets: v })} />
          </div>
        </div>
        <Field label="Response" hint={comment.responded_at ? `Responded ${formatDateTime(comment.responded_at)} by ${comment.responded_by_detail?.short_name ?? ""}` : "A response is needed to close."}>
          {(p) => <textarea {...p} rows={4} disabled={done} className="w-full rounded-sm border border-border bg-surface p-2 text-body" value={response} onChange={(e) => setResponse(e.target.value)} />}
        </Field>
        {comment.status === "rejected" && <p className="text-small">Rejected: {comment.reject_reason}</p>}
        {error && <p role="alert" className="text-small text-danger">{error}</p>}
        <div className="flex flex-wrap gap-2">
          {!done && (
            <>
              <Button variant="primary" busy={update.isPending && update.variables?.action === "respond"} disabled={!response.trim()} onClick={() => update.mutate({ response, action: "respond" })}>Save response</Button>
              <Button busy={update.isPending && update.variables?.action === "close"} disabled={!response.trim()} onClick={() => update.mutate({ response, action: "close" })}>Close</Button>
              <label className="inline-flex cursor-pointer items-center rounded-sm border border-border px-3 text-body hover:bg-surface-muted">
                Attach files
                <input type="file" multiple accept="application/pdf,image/jpeg,image/png" className="sr-only" onChange={(e) => e.target.files && attach.mutate([...e.target.files])} />
              </label>
            </>
          )}
          {(done || comment.status === "responded") && <Button onClick={() => update.mutate({ action: "reopen" })}>Reopen</Button>}
        </div>
        {!done && (
          <div className="flex items-end gap-2 border-t border-border pt-3">
            <Field label="Reject with reason" className="flex-1">{(p) => <TextInput {...p} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
            <Button variant="danger" disabled={!reason.trim()} onClick={() => update.mutate({ action: "reject", reject_reason: reason })}>Reject</Button>
          </div>
        )}
      </div>
    </Drawer>
  );
}

/** F-25: email from unknown senders waits here; PL/DL/DC accept it as a comment or discard it. */
function EmailQueue() {
  const { project } = useProjectContext();
  const queryClient = useQueryClient();
  const toast = useToast();
  const queue = useQuery({
    queryKey: ["projects", project.id, "inbound", "review"],
    queryFn: () => unwrap(api.GET("/api/v1/projects/{project_pk}/inbound-emails", { params: { path: { project_pk: project.id }, query: { state: "review" } } })),
  });
  const decide = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) => unwrap(api.POST("/api/v1/inbound-emails/{id}/review", { params: { path: { id } }, body: { accept } })),
    onSuccess: (e) => {
      queryClient.invalidateQueries({ queryKey: ["projects", project.id, "inbound"] });
      queryClient.invalidateQueries({ queryKey: commentsKey(project.id) });
      toast({ title: e.state === "processed" ? `Logged as ${e.comment_number}` : "Email discarded" });
    },
  });
  const rows = queue.data ?? [];
  if (rows.length === 0) return null;
  return (
    <Card title={`Emails from unknown senders · ${rows.length}`}>
      <ul className="flex flex-col divide-y divide-border">
        {rows.map((e) => (
          <li key={e.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-body font-semibold">{e.subject || "(no subject)"}</p>
              <p className="text-small text-muted">{e.from_name} &lt;{e.from_address}&gt; · {formatDateTime(e.received_at)}</p>
              <p className="mt-1 line-clamp-3 text-small whitespace-pre-wrap">{e.text}</p>
              {e.raw_url && <a className="text-small text-primary underline" href={e.raw_url}>Original email</a>}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="primary" busy={decide.isPending && decide.variables?.id === e.id && decide.variables.accept} onClick={() => decide.mutate({ id: e.id, accept: true })}>Log as comment</Button>
              <Button size="sm" onClick={() => decide.mutate({ id: e.id, accept: false })}>Discard</Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
