import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Field, Select, TextInput } from "@/components/ui/Field";
import { Card, tableClass, tdClass, thClass } from "@/components/ui/PageHeader";
import { PdfViewer } from "@/components/ui/PdfViewer";
import { EmptyState } from "@/components/ui/States";
import type { SheetState } from "@/components/ui/status";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, readCookie, type Schemas, unwrap } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { uploadFile } from "@/lib/upload";
import { projectKeys } from "@/features/projects/api";
import { useProjectContext } from "@/features/projects/ProjectLayout";
import { useSheets } from "@/features/register/useSheets";

type Contact = Schemas["Contact"];
type Transmittal = Schemas["TransmittalDetail"];

/** S-07 Issue and transmittal composer (F-14, F-08). */
export function IssueComposer() {
  const { project } = useProjectContext();
  const [params] = useSearchParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const sheets = useSheets(project.id);
  const settings = useQuery({ queryKey: ["org-settings"], queryFn: () => unwrap(api.GET("/api/v1/org/settings")) });
  const [selected, setSelected] = useState<string[]>(() => params.get("sheets")?.split(",").filter(Boolean) ?? []);
  const [purpose, setPurpose] = useState("");
  const [suitability, setSuitability] = useState("");
  const [recipients, setRecipients] = useState<Contact[]>([]);
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState<Transmittal | null>(null);
  const canIssue = !!project.my_permissions.issue;

  const approved = (sheets.data ?? []).filter((s) => s.state === "approved_for_issue" || selected.includes(s.id));
  const body = useMemo(
    () => ({ sheet_ids: selected, purpose, suitability, contact_ids: recipients.map((r) => r.id), note }),
    [selected, purpose, suitability, recipients, note],
  );
  const ready = selected.length > 0 && !!purpose && recipients.length > 0;

  const preview = useQuery({
    queryKey: ["issue-preview", project.id, body],
    queryFn: () => unwrap(api.POST("/api/v1/projects/{project_pk}/transmittals/preview", { params: { path: { project_pk: project.id } }, body })),
    enabled: ready && canIssue,
    refetchInterval: false,
    retry: false,
  });
  const blocked = new Map((preview.data?.blocked ?? []).map((b) => [b.sheet_id, b.reason]));

  const issue = useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/projects/{project_pk}/transmittals", { params: { path: { project_pk: project.id } }, body })),
    onSuccess: (t) => {
      setConfirm(false);
      setDone(t);
      queryClient.invalidateQueries({ queryKey: projectKeys.sheets(project.id) });
      queryClient.invalidateQueries({ queryKey: ["transmittals", project.id] });
      toast({ title: `${t.number} sent` });
    },
  });

  if (!canIssue) return <EmptyState message="Only the project lead or document controller can issue drawings." />;
  if (done) return <IssuedSummary transmittal={done} />;

  const purposes = (settings.data?.purpose_codes ?? []).filter((p) => p.active !== false);
  const suitabilities = (settings.data?.suitability_codes ?? []).filter((p) => p.active !== false);
  const toggle = (id: string) => setSelected((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-title font-semibold">Issue drawings</h2>

      <Card title="1. Sheets">
        {approved.length === 0 ? (
          <EmptyState message="No sheets are approved for issue yet." action={<Link className="text-primary underline" to="../register">Open register</Link>} />
        ) : (
          <table className={tableClass}>
            <thead>
              <tr>
                <th scope="col" className={thClass}><span className="sr-only">Include</span></th>
                <th scope="col" className={thClass}>Sheet</th>
                <th scope="col" className={thClass}>Title</th>
                <th scope="col" className={thClass}>State</th>
                <th scope="col" className={thClass}>PDF</th>
              </tr>
            </thead>
            <tbody>
              {approved.map((s) => {
                const reason = selected.includes(s.id) ? blocked.get(s.id) : undefined;
                return (
                  <tr key={s.id} style={reason ? { background: "var(--flag-at_risk-bg)" } : undefined}>
                    <td className={tdClass}><input type="checkbox" aria-label={`Include ${s.number}`} checked={selected.includes(s.id)} onChange={() => toggle(s.id)} /></td>
                    <td className={tdClass}><span className="mono font-semibold">{s.number}</span></td>
                    <td className={tdClass}>{s.title}</td>
                    <td className={tdClass}><StatusChip state={s.state as SheetState} /></td>
                    <td className={`${tdClass} text-small`}>
                      {reason ? (
                        <span className="flex flex-wrap items-center gap-2">
                          <span style={{ color: "var(--flag-at_risk-fg)" }}>{reason}</span>
                          {reason === "Upload PDF first." && <RowUpload sheetId={s.id} onDone={() => preview.refetch()} />}
                        </span>
                      ) : (
                        <span className="text-muted">{selected.includes(s.id) ? "Ready" : "—"}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="2. Purpose and recipients">
        <div className="grid gap-4 p-4 md:grid-cols-2">
          <Field label="Purpose" hint="Required. Printed on the cover sheet and every revision.">
            {(a) => (
              <Select {...a} required value={purpose} onChange={(e) => setPurpose(e.target.value)}>
                <option value="">Choose…</option>
                {purposes.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Suitability (optional, ISO 19650)">
            {(a) => (
              <Select {...a} value={suitability} onChange={(e) => setSuitability(e.target.value)}>
                <option value="">None</option>
                {suitabilities.map((p) => <option key={p.code} value={p.code}>{p.code} {p.label}</option>)}
              </Select>
            )}
          </Field>
          <div className="md:col-span-2"><RecipientPicker value={recipients} onChange={setRecipients} /></div>
          <Field label="Note (optional)" className="md:col-span-2">
            {(a) => <textarea {...a} rows={3} className="w-full rounded-sm border border-border bg-surface p-2" value={note} onChange={(e) => setNote(e.target.value)} />}
          </Field>
        </div>
      </Card>

      <Card title="3. Preview">
        {!ready ? (
          <p className="p-4 text-body text-muted">Choose sheets, a purpose and at least one recipient to see the cover sheet.</p>
        ) : (
          <div className="flex flex-col gap-3 p-4">
            {preview.error && <p role="alert" className="text-small text-danger">{preview.error.message}</p>}
            {preview.data && (
              <p className="text-body font-semibold" role="status">
                {preview.data.summary} <span className="mono font-normal text-muted">· {preview.data.next_number}</span>
              </p>
            )}
            <CoverPreview projectId={project.id} body={body} />
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" disabled={!preview.data || preview.data.blocked.length > 0} onClick={() => setConfirm(true)}>
                Issue {selected.length} sheet{selected.length === 1 ? "" : "s"}
              </Button>
              {preview.data && preview.data.blocked.length > 0 && <span className="text-small text-muted">Fix or remove the highlighted sheets first.</span>}
            </div>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Issue ${selected.length} sheet${selected.length === 1 ? "" : "s"}?`}
        confirmLabel={`Issue ${selected.length} sheet${selected.length === 1 ? "" : "s"}`}
        busy={issue.isPending}
        onConfirm={() => issue.mutate()}
      >
        <p>{preview.data?.summary}</p>
        <p className="mt-2">Emails go out at once and cannot be recalled. Mistakes are corrected with a new transmittal.</p>
        {issue.error && <p className="mt-2 text-danger">{issue.error instanceof ApiError ? issue.error.message : "Not issued."}</p>}
      </ConfirmDialog>
    </div>
  );
}

function RowUpload({ sheetId, onDone }: { sheetId: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <label className="inline-flex cursor-pointer items-center rounded-sm border border-border px-2 py-0.5 hover:bg-surface-muted">
      {busy ? "Uploading…" : "Add PDF"}
      <input
        type="file"
        accept="application/pdf"
        className="sr-only"
        disabled={busy}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setBusy(true);
          setError("");
          try {
            const up = await uploadFile(file, "sheet");
            await unwrap(api.POST("/api/v1/sheets/{id}/revisions", { params: { path: { id: sheetId } }, body: { upload_id: up.id } }));
            setTimeout(onDone, 1200); // the naming check runs on the worker
          } catch (err) {
            setError(err instanceof Error ? err.message : "Upload failed");
          } finally {
            setBusy(false);
          }
        }}
      />
      {error && <span className="ml-2 text-danger">{error}</span>}
    </label>
  );
}

function RecipientPicker({ value, onChange }: { value: Contact[]; onChange: (v: Contact[]) => void }) {
  const [q, setQ] = useState("");
  const results = useQuery({
    queryKey: ["contacts", "pick", q],
    queryFn: () => unwrap(api.GET("/api/v1/contacts", { params: { query: { q: q || undefined, page_size: 20 } } })),
    enabled: q.trim().length > 0,
  });
  const chosen = new Set(value.map((c) => c.id));
  return (
    <div className="flex flex-col gap-2">
      <span className="text-small font-semibold text-muted" id="recipients-label">Recipients</span>
      <ul className="flex flex-wrap gap-2" aria-labelledby="recipients-label">
        {value.map((c) => (
          <li key={c.id} className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-muted px-2 py-0.5 text-small">
            {c.full_name}{c.external_org_name ? ` · ${c.external_org_name}` : ""}{!c.email && " · by hand"}
            <button type="button" aria-label={`Remove ${c.full_name}`} onClick={() => onChange(value.filter((x) => x.id !== c.id))}><X size={12} aria-hidden="true" /></button>
          </li>
        ))}
      </ul>
      <TextInput aria-label="Find a contact to add" placeholder="Type a name, email or organisation" value={q} onChange={(e) => setQ(e.target.value)} />
      {q && (
        <ul className="max-h-48 overflow-y-auto rounded-sm border border-border" aria-label="Matching contacts">
          {(results.data?.results ?? []).filter((c) => !chosen.has(c.id) && c.is_active !== false).map((c) => (
            <li key={c.id}>
              <button type="button" className="w-full px-3 py-1.5 text-left text-body hover:bg-surface-muted" onClick={() => { onChange([...value, c]); setQ(""); }}>
                {c.full_name} <span className="text-small text-muted">{c.email || "no email: issued by hand"}{c.external_org_name ? ` · ${c.external_org_name}` : ""}</span>
              </button>
            </li>
          ))}
          {results.data && results.data.results.length === 0 && <li className="px-3 py-1.5 text-small text-muted">No contacts match. Add them in Contacts.</li>}
        </ul>
      )}
    </div>
  );
}

/** The cover sheet exactly as it will be sent, marked PREVIEW (rendered by the server). */
function CoverPreview({ projectId, body }: { projectId: string; body: unknown }) {
  const [url, setUrl] = useState<string | null>(null);
  const key = JSON.stringify(body);
  useEffect(() => {
    let revoke: string | null = null;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const response = await fetch(`/api/v1/projects/${projectId}/transmittals/cover-preview`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRFToken": readCookie("csrftoken") ?? "" },
        body: key,
      });
      if (!response.ok || cancelled) return;
      revoke = URL.createObjectURL(await response.blob());
      setUrl(revoke);
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [projectId, key]);
  return <PdfViewer url={url} filename="Cover sheet (preview)" />;
}

function IssuedSummary({ transmittal }: { transmittal: Transmittal }) {
  return (
    <Card>
      <div className="flex flex-col items-start gap-3 p-6">
        <p className="flex items-center gap-2 text-title font-semibold" style={{ color: "var(--state-issued-fg)" }}>
          <CircleCheck size={20} aria-hidden="true" /> Issued
        </p>
        <p className="text-body">
          Transmittal <span className="mono font-semibold">{transmittal.number}</span>: {transmittal.items.length} sheets to {transmittal.recipients.length} recipients for {transmittal.purpose_label}.
          Emails with secure download links are on their way.
        </p>
        <div className={cn("flex flex-wrap gap-2")}>
          <Link to={`../transmittals/${transmittal.id}`} className="inline-flex h-9 items-center rounded-sm bg-primary px-3 font-semibold text-on-primary">Open transmittal</Link>
          <Link to="../register" className="inline-flex h-9 items-center rounded-sm border border-border px-3 font-semibold">Back to register</Link>
        </div>
      </div>
    </Card>
  );
}
