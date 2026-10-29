import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Pencil, Upload } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";

import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Dialog";
import { FlagPill } from "@/components/ui/FlagPill";
import { PdfViewer } from "@/components/ui/PdfViewer";
import { ErrorState, SkeletonRows } from "@/components/ui/States";
import type { SheetState } from "@/components/ui/status";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, unwrap } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime } from "@/lib/format";
import { uploadFile } from "@/lib/upload";
import { projectKeys } from "@/features/projects/api";
import { useProjectContext } from "@/features/projects/ProjectLayout";
import { SheetForm } from "@/features/register/SheetForm";
import { flagFor } from "@/features/register/useSheets";

import { FindingsPanel } from "@/features/intelligence/FindingsPanel";

import { ActionBar, PrecheckPanel } from "./ActionBar";
import { type Revision, sheetKeys, useRevisionLink, useRevisions, useSheetDetail, useSheetReviews, useTimeline } from "./api";

/** S-06 Sheet detail (F-06, F-07, F-10, F-11, F-47, F-48). */
export function SheetDetailPage() {
  const { sheetId = "" } = useParams();
  const { project } = useProjectContext();
  const sheet = useSheetDetail(sheetId);
  const revisions = useRevisions(sheetId);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const toast = useToast();

  const list = revisions.data ?? [];
  const current = list.find((r) => r.id === selected) ?? list.find((r) => r.state === "issued") ?? list.find((r) => r.has_file) ?? null;

  const linkQuery = useRevisionLink(current?.id, !!current?.has_file);
  const link = current?.has_file ? linkQuery.data ?? null : null;

  if (sheet.isPending) return <SkeletonRows label="Loading sheet" />;
  if (sheet.error) {
    const notFound = sheet.error instanceof ApiError && sheet.error.status === 404;
    return <ErrorState message={notFound ? "This sheet does not exist or you cannot see it." : sheet.error.message} onRetry={notFound ? undefined : () => sheet.refetch()} />;
  }
  const s = sheet.data;
  const successor = current?.state === "superseded" ? list.find((r) => r.seq > current.seq && r.state !== "draft") : undefined;
  const banner =
    current?.state === "superseded"
      ? `Superseded on ${formatDate(current.superseded_at)}${successor ? ` by ${successor.code}` : ""}. Do not use for construction.`
      : undefined;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-2">
        <p className="text-small text-muted">
          <Link className="text-primary hover:underline" to={`/projects/${project.id}/register`}>Register</Link> › {s.number}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-display font-semibold">
            <span className="mono">{s.number}</span> · {s.title}
          </h2>
          <StatusChip state={s.state as SheetState} revision={s.current_revision_code ?? undefined} />
          {(s.flags ?? []).map((f) => {
            const pill = flagFor(f);
            return <FlagPill key={f.kind} kind={pill.kind} text={pill.text} detail={pill.detail} />;
          })}
        </div>
        <p className="text-small text-muted">
          {s.discipline_code} · Stage {s.stage_name}
          {s.package_name ? ` · Package: ${s.package_name}` : ""} · Owner {s.owner_detail?.short_name ?? "—"} · Checker {s.checker_detail?.short_name ?? "—"}
          {s.effective_planned_date ? ` · Planned ${formatDate(s.effective_planned_date)}` : ""}
          {s.stage_requires_senior_qc ? " · Senior QC required" : ""}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <ActionBar sheet={s} />
          {s.editable_fields.length > 0 && (
            <Button variant="ghost" icon={<Pencil size={14} aria-hidden="true" />} onClick={() => setEditing(true)}>Edit</Button>
          )}
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <PdfViewer
          url={link?.url ?? null}
          filename={current ? `${s.number} ${current.code}${current.state === "draft" ? " (draft)" : ""}` : s.number}
          supersededBanner={banner}
          onDownload={link ? () => window.open(link.url, "_blank", "noopener") : undefined}
        />
        <aside className="flex flex-col gap-4">
          <PrecheckPanel sheetId={s.id} state={s.state} />
          {project.my_permissions.review_findings && <FindingsPanel sheetId={s.id} />}
          <Revisions sheetId={s.id} projectId={project.id} revisions={list} selected={current?.id ?? null} onSelect={setSelected} canUpload={s.can_upload_draft} />
          <Reviews sheetId={s.id} />
          <Distribution sheetId={s.id} />
          <Activity sheetId={s.id} />
        </aside>
      </div>

      {s.cad_link && (
        <p className="flex flex-wrap items-center gap-2 text-small">
          <span className="text-muted">CAD file:</span>
          <code className="rounded-sm bg-surface-muted px-1.5 py-0.5">{s.cad_link}</code>
          <Button size="sm" variant="ghost" icon={<Copy size={12} aria-hidden="true" />} onClick={() => navigator.clipboard?.writeText(s.cad_link ?? "").then(() => toast({ title: "Path copied" }))}>
            Copy path
          </Button>
          {s.cad_link.startsWith("https://") && <a className="text-primary underline" href={s.cad_link ?? ""} target="_blank" rel="noreferrer noopener">Open in CAD location</a>}
        </p>
      )}
      <CadActivity sheetId={s.id} />

      <Drawer open={editing} onOpenChange={setEditing} title={`Edit ${s.number}`}>
        {editing && (s.editable_fields.length > 1 ? <SheetForm sheet={s} onDone={() => setEditing(false)} /> : <NotesForm sheetId={s.id} notes={s.notes ?? ""} onDone={() => setEditing(false)} />)}
      </Drawer>
    </div>
  );
}

function Revisions({
  sheetId, projectId, revisions, selected, onSelect, canUpload,
}: { sheetId: string; projectId: string; revisions: Revision[]; selected: string | null; onSelect: (id: string) => void; canUpload: boolean }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const upload = async (file: File) => {
    setBusy(true);
    setError("");
    try {
      const done = await uploadFile(file, "sheet");
      await unwrap(api.POST("/api/v1/sheets/{id}/revisions", { params: { path: { id: sheetId } }, body: { upload_id: done.id } }));
      for (const key of [sheetKeys.revisions(sheetId), sheetKeys.detail(sheetId), sheetKeys.timeline(sheetId), projectKeys.sheets(projectId)]) {
        queryClient.invalidateQueries({ queryKey: key });
      }
      toast({ title: `${file.name} uploaded`, description: "Checking the file name…" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-md border border-border bg-surface" aria-labelledby="rev-title">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <h3 id="rev-title" className="font-semibold">Revisions</h3>
        {canUpload && (
          <label className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-sm border border-border px-2 text-small font-semibold hover:bg-surface-muted">
            <Upload size={12} aria-hidden="true" /> {busy ? "Uploading…" : "Upload PDF"}
            <input type="file" accept="application/pdf" className="sr-only" disabled={busy} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </label>
        )}
      </div>
      {error && <p role="alert" className="px-4 pt-2 text-small text-danger">{error}</p>}
      {revisions.length === 0 ? (
        <p className="px-4 py-3 text-small text-muted">No revisions yet. Upload the PDF when the sheet is ready for check or issue.</p>
      ) : (
        <ul>
          {revisions.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => onSelect(r.id)}
                aria-pressed={selected === r.id}
                className={cn("flex w-full flex-col gap-0.5 border-b border-border px-4 py-2 text-left last:border-0 hover:bg-surface-muted", selected === r.id && "bg-surface-muted")}
              >
                <span className="flex items-center gap-2">
                  <span className="mono font-semibold">{r.code}</span>
                  <span className={cn("text-small", r.state === "superseded" && "line-through")}>{r.state}</span>
                  {r.purpose && <span className="text-small text-muted">· {r.purpose}</span>}
                  {r.transmittal_number && <span className="mono text-small text-muted">· {r.transmittal_number}</span>}
                </span>
                <span className="text-small text-muted">
                  {r.issued_at ? `Issued ${formatDate(r.issued_at)}` : r.superseded_at ? `Superseded ${formatDate(r.superseded_at)}` : `Uploaded ${formatDate(r.created_at)}`}
                  {r.uploaded_by ? ` · ${r.uploaded_by.short_name}` : ""}
                </span>
                {r.state === "draft" && r.has_file && r.naming_status !== "ok" && (
                  <span className="text-small" style={{ color: r.naming_status === "blocked" ? "var(--flag-late-fg)" : "var(--text-muted)" }}>
                    {r.naming_status === "blocked" ? r.naming_message : "Checking the file name…"}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Reviews({ sheetId }: { sheetId: string }) {
  const reviews = useSheetReviews(sheetId);
  const list = reviews.data ?? [];
  if (list.length === 0) return null;
  return (
    <section className="rounded-md border border-border bg-surface" aria-labelledby="reviews-title">
      <h3 id="reviews-title" className="border-b border-border px-4 py-2 font-semibold">Reviews</h3>
      <ul>
        {list.map((r) => (
          <li key={r.id} className="border-b border-border px-4 py-2 text-small last:border-0">
            <p>
              <span className="font-semibold">{r.kind === "senior_qc" ? "Senior QC" : "Check"}</span> · {r.state}
              {r.revision_code ? ` · ${r.revision_code}` : ""} · {r.reviewer?.short_name ?? "Any senior reviewer"}
            </p>
            {r.comment && <p className="mt-1 whitespace-pre-wrap">{r.comment}</p>}
            {r.redline_files.length > 0 && <p className="mt-1 text-muted">{r.redline_files.length} redline file{r.redline_files.length > 1 ? "s" : ""}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Activity({ sheetId }: { sheetId: string }) {
  const timeline = useTimeline(sheetId);
  return (
    <section className="rounded-md border border-border bg-surface" aria-labelledby="activity-title">
      <h3 id="activity-title" className="border-b border-border px-4 py-2 font-semibold">Activity</h3>
      {(timeline.data ?? []).length === 0 ? (
        <p className="px-4 py-3 text-small text-muted">Nothing yet.</p>
      ) : (
        <ol className="max-h-80 overflow-y-auto">
          {(timeline.data ?? []).map((e, i) => (
            <li key={i} className="border-b border-border px-4 py-2 text-small last:border-0">
              <span className="text-muted">{formatDateTime(e.at)}</span> · {e.actor && <span className="font-semibold">{e.actor} </span>}
              {e.text}
              {e.detail && <span className="block text-muted">{e.detail}</span>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function NotesForm({ sheetId, notes, onDone }: { sheetId: string; notes: string; onDone: () => void }) {
  const { project } = useProjectContext();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [value, setValue] = useState(notes);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await unwrap(api.PATCH("/api/v1/sheets/{id}", { params: { path: { id: sheetId } }, body: { notes: value } }));
        setBusy(false);
        queryClient.invalidateQueries({ queryKey: sheetKeys.detail(sheetId) });
        queryClient.invalidateQueries({ queryKey: projectKeys.sheets(project.id) });
        toast({ title: "Notes saved" });
        onDone();
      }}
    >
      <label htmlFor="notes" className="text-small font-semibold text-muted">Working notes</label>
      <textarea id="notes" rows={6} className="rounded-sm border border-border bg-surface p-2" value={value} onChange={(e) => setValue(e.target.value)} />
      <div className="flex gap-2">
        <Button type="submit" variant="primary" busy={busy}>Save notes</Button>
        <Button onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}

/** "Who has which revision" for this sheet (03 §8). */
export function Distribution({ sheetId }: { sheetId: string }) {
  const rows = useQuery({
    queryKey: ["sheet", sheetId, "distribution"],
    queryFn: () => unwrap(api.GET("/api/v1/sheets/{id}/distribution", { params: { path: { id: sheetId } } })),
  });
  if (!rows.data?.length) return null;
  return (
    <section className="rounded-md border border-border bg-surface" aria-labelledby="dist-title">
      <h3 id="dist-title" className="border-b border-border px-4 py-2 font-semibold">Who has which revision</h3>
      <ul>
        {rows.data.map((r, i) => (
          <li key={i} className="border-b border-border px-4 py-2 text-small last:border-0">
            <span className="font-semibold">{r.contact}</span>{r.organisation ? ` · ${r.organisation}` : ""}: <span className={`mono ${r.revision_state === "superseded" ? "line-through" : ""}`}>{r.revision}</span> via <span className="mono">{r.transmittal}</span>
            <span className="block text-muted">{r.delivery === "hand" ? "By hand" : r.downloaded_at ? `Downloaded ${formatDateTime(r.downloaded_at)}` : "Not downloaded yet"}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}


const CAD_EVENT: Record<string, string> = { created: "created", modified: "changed", deleted: "deleted", renamed: "renamed" };

/** I-02: "CAD file changed" activity reported by the storage connector (no file is copied). */
function CadActivity({ sheetId }: { sheetId: string }) {
  const events = useQuery({
    queryKey: ["sheet", sheetId, "cad-events"],
    queryFn: () => unwrap(api.GET("/api/v1/sheets/{id}/cad-events", { params: { path: { id: sheetId } } })),
  });
  const rows = events.data ?? [];
  if (rows.length === 0) return null;
  return (
    <section aria-label="CAD file activity" className="text-small">
      <h2 className="mb-1 font-semibold">CAD file activity</h2>
      <ul className="flex flex-col gap-0.5">
        {rows.slice(0, 5).map((e) => (
          <li key={e.id}>
            <span className="tabular text-muted">{formatDateTime(e.at)}</span> {e.path.split(/[\\/]/).pop()} {CAD_EVENT[e.event] ?? e.event}
            {e.by && <span className="text-muted"> by {e.by}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
