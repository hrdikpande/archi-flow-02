import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, FileCheck2, FilePen, Plus, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Field, Select, TextInput } from "@/components/ui/Field";
import { Card } from "@/components/ui/PageHeader";
import { DataState, EmptyState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { useProjectContext } from "@/features/projects/ProjectLayout";
import { useSheets } from "@/features/register/useSheets";
import { api, type Schemas, unwrap } from "@/lib/api/client";
import { formatDate, formatDateTime, todayISO } from "@/lib/format";
import { uploadFile } from "@/lib/upload";

import { PARTY, Pill, useOpenParam } from "./common";

const key = (projectId: string) => ["projects", projectId, "site-reports"] as const;

/** F-32 site visit reports: filed from a phone (44 px targets, camera input), photos ≤ 2 MB,
 * export to PDF on filing. */
export function SiteReports() {
  const { project } = useProjectContext();
  const reports = useQuery({ queryKey: key(project.id), queryFn: () => unwrap(api.GET("/api/v1/projects/{project_pk}/site-reports", { params: { path: { project_pk: project.id } } })) });
  const [openId, setOpen] = useOpenParam();
  const queryClient = useQueryClient();
  const create = useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/projects/{project_pk}/site-reports", { params: { path: { project_pk: project.id } }, body: { visit_date: todayISO() } as Schemas["SiteReportRequest"] })),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: key(project.id) });
      setOpen(r.id);
    },
  });
  if (openId) return <ReportEditor id={openId} onBack={() => setOpen(null)} />;
  const rows = reports.data ?? [];
  return (
    <Card title="Site visit reports" actions={project.my_permissions.file_site_report && <Button size="sm" variant="primary" className="min-h-11" icon={<Plus size={14} aria-hidden="true" />} busy={create.isPending} onClick={() => create.mutate()}>New report</Button>}>
      <DataState isPending={reports.isPending} error={reports.error} isEmpty={rows.length === 0} onRetry={() => reports.refetch()} empty={<EmptyState message="No site visits recorded yet." />}>
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id}>
              <button type="button" className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface-muted" onClick={() => setOpen(r.id)}>
                <span>
                  <span className="mono font-semibold">{r.number.split("-").slice(-2).join("-")}</span> · visit {formatDate(r.visit_date)}
                  <span className="block text-small text-muted">{r.observation_count} observation{r.observation_count === 1 ? "" : "s"} · {r.created_by_detail?.short_name}</span>
                </span>
                {r.state === "filed" ? <Pill label="Filed" icon={FileCheck2} tone="issued" /> : <Pill label="Draft" icon={FilePen} tone="planned" />}
              </button>
            </li>
          ))}
        </ul>
      </DataState>
    </Card>
  );
}

function ReportEditor({ id, onBack }: { id: string; onBack: () => void }) {
  const { project } = useProjectContext();
  const queryClient = useQueryClient();
  const toast = useToast();
  const report = useQuery({ queryKey: ["site-report", id], queryFn: () => unwrap(api.GET("/api/v1/site-reports/{id}", { params: { path: { id } } })) });
  const [filing, setFiling] = useState(false);
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["site-report", id] });
    queryClient.invalidateQueries({ queryKey: key(project.id) });
  };
  const save = useMutation({
    mutationFn: (body: Schemas["PatchedSiteReportDetailRequest"]) => unwrap(api.PATCH("/api/v1/site-reports/{id}", { params: { path: { id } }, body })),
    onSuccess: refresh,
  });
  const file = useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/site-reports/{id}/file", { params: { path: { id } } })),
    onSuccess: (r) => {
      refresh();
      setFiling(false);
      toast({ title: `${r.number} filed`, description: "The PDF is ready to download." });
    },
    onError: (e) => {
      setFiling(false);
      toast({ title: "Not filed", description: e.message });
    },
  });
  const remove = useMutation({
    mutationFn: (oid: string) => unwrap(api.DELETE("/api/v1/observations/{id}", { params: { path: { id: oid } } })),
    onSuccess: refresh,
  });
  const r = report.data;
  const editable = r?.state === "draft" && !!project.my_permissions.file_site_report;
  return (
    <DataState isPending={report.isPending} error={report.error} isEmpty={false} empty={null} onRetry={() => report.refetch()}>
      {r && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button className="min-h-11" onClick={onBack}>All reports</Button>
            <div className="flex gap-2">
              {r.pdf_link && <a className="inline-flex min-h-11 items-center rounded-sm border border-border px-3 text-primary" href={r.pdf_link.url} target="_blank" rel="noopener noreferrer">Download PDF</a>}
              {editable && <Button variant="primary" className="min-h-11" onClick={() => setFiling(true)}>File report</Button>}
            </div>
          </div>
          <Card title={`${r.number} · ${r.state === "filed" ? `filed ${formatDateTime(r.filed_at)}` : "draft"}`}>
            <div className="grid gap-3 p-4 md:grid-cols-2">
              <Field label="Visit date">{(p) => <TextInput {...p} type="date" disabled={!editable} defaultValue={r.visit_date} onBlur={(e) => e.target.value !== r.visit_date && save.mutate({ visit_date: e.target.value })} />}</Field>
              <Field label="Weather">{(p) => <TextInput {...p} disabled={!editable} defaultValue={r.weather} onBlur={(e) => e.target.value !== r.weather && save.mutate({ weather: e.target.value })} />}</Field>
              <Field label="Attendees" className="md:col-span-2">{(p) => <textarea {...p} rows={2} disabled={!editable} className="rounded-sm border border-border bg-surface p-2" defaultValue={r.attendees} onBlur={(e) => e.target.value !== r.attendees && save.mutate({ attendees: e.target.value })} />}</Field>
              <Field label="Summary" className="md:col-span-2">{(p) => <textarea {...p} rows={3} disabled={!editable} className="rounded-sm border border-border bg-surface p-2" defaultValue={r.summary} onBlur={(e) => e.target.value !== r.summary && save.mutate({ summary: e.target.value })} />}</Field>
            </div>
          </Card>
          <Card title={`Observations (${r.observations.length})`}>
            <ol className="divide-y divide-border">
              {r.observations.map((o) => (
                <li key={o.id} className="flex flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="whitespace-pre-wrap"><span className="font-semibold">{o.seq}.</span> {o.sheet_number && <span className="mono">{o.sheet_number} · </span>}{o.text}</p>
                    {editable && <Button size="sm" variant="ghost" aria-label={`Remove observation ${o.seq}`} icon={<Trash2 size={14} aria-hidden="true" />} onClick={() => remove.mutate(o.id)} />}
                  </div>
                  {o.action && <p className="rounded-sm bg-surface-muted px-2 py-1 text-small"><strong>Action{o.action_owner && ` (${PARTY[o.action_owner]})`}:</strong> {o.action}</p>}
                  {o.photo_links.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {o.photo_links.map((p, i) => <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer"><img src={p.url} alt={`Observation ${o.seq} photo ${i + 1}`} className="h-24 w-32 rounded-sm border border-border object-cover" /></a>)}
                    </div>
                  )}
                </li>
              ))}
              {r.observations.length === 0 && <li className="p-4 text-small text-muted">No observations yet.</li>}
            </ol>
            {editable && <NewObservation reportId={id} onAdded={refresh} />}
          </Card>
          <ConfirmDialog open={filing} onOpenChange={setFiling} title={`File ${r.number}?`} confirmLabel="File report" busy={file.isPending} onConfirm={() => file.mutate()}>
            The report is locked and its PDF is generated with all photos. It cannot be edited afterwards.
          </ConfirmDialog>
        </div>
      )}
    </DataState>
  );
}

function NewObservation({ reportId, onAdded }: { reportId: string; onAdded: () => void }) {
  const { project } = useProjectContext();
  const sheets = useSheets(project.id);
  const [text, setText] = useState("");
  const [sheet, setSheet] = useState("");
  const [action, setAction] = useState("");
  const [owner, setOwner] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [error, setError] = useState<string>();
  const add = useMutation({
    mutationFn: async () => {
      const photo_ids: string[] = [];
      for (const f of photos) photo_ids.push((await uploadFile(f, "image")).id);
      return unwrap(api.POST("/api/v1/site-reports/{id}/observations", { params: { path: { id: reportId } }, body: { text, sheet: sheet || null, action, action_owner: owner, photo_ids } }));
    },
    onSuccess: () => {
      setText("");
      setAction("");
      setPhotos([]);
      onAdded();
    },
    onError: (e) => setError(e.message),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(undefined);
    add.mutate();
  };
  return (
    <form className="flex flex-col gap-3 border-t border-border p-4" onSubmit={submit}>
      <Field label="What did you see?">{(p) => <textarea {...p} required rows={3} className="rounded-sm border border-border bg-surface p-2" value={text} onChange={(e) => setText(e.target.value)} />}</Field>
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Sheet">{(p) => <Select {...p} className="min-h-11" value={sheet} onChange={(e) => setSheet(e.target.value)}><option value="">None</option>{sheets.data?.map((s) => <option key={s.id} value={s.id}>{s.number}</option>)}</Select>}</Field>
        <Field label="Action" className="md:col-span-2">{(p) => <TextInput {...p} className="min-h-11" value={action} onChange={(e) => setAction(e.target.value)} />}</Field>
      </div>
      <Field label="Action by">{(p) => <Select {...p} className="min-h-11" value={owner} onChange={(e) => setOwner(e.target.value)}><option value="">—</option>{["firm", "client", "contractor", "consultant"].map((v) => <option key={v} value={v}>{PARTY[v]}</option>)}</Select>}</Field>
      <label className="inline-flex min-h-11 w-fit cursor-pointer items-center gap-2 rounded-sm border border-border px-3 hover:bg-surface-muted">
        <Camera size={16} aria-hidden="true" /> {photos.length ? `${photos.length} photo${photos.length > 1 ? "s" : ""}` : "Add photos"}
        <input type="file" accept="image/jpeg,image/png" capture="environment" multiple className="sr-only" onChange={(e) => setPhotos([...(e.target.files ?? [])].slice(0, 12))} />
      </label>
      <p className="text-small text-muted">Photos are reduced to 2 MB or less and their location data is removed.</p>
      {error && <p role="alert" className="text-small text-danger">{error}</p>}
      <Button type="submit" variant="primary" className="min-h-11 self-end" busy={add.isPending}>Add observation</Button>
    </form>
  );
}
