import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, FileSpreadsheet, Undo2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { Button } from "@/components/ui/Button";
import { Select, TextInput } from "@/components/ui/Field";
import { Card, tableClass, tdClass, thClass } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, readCookie, type Schemas, unwrap } from "@/lib/api/client";
import { formatDateTime } from "@/lib/format";
import { projectKeys } from "@/features/projects/api";
import { useProjectContext } from "@/features/projects/ProjectLayout";

type Job = Schemas["ImportJob"];
interface ReportRow {
  row: number;
  index: number;
  status: "ok" | "error" | "skipped";
  values: Record<string, string>;
  errors: string[];
}
interface Report {
  missing_columns: string[];
  rows: ReportRow[];
  counts: { ok: number; error: number; skipped: number; total: number };
}

/** S-12: upload → column mapping → preview with row errors → commit → result with Undo (24 h). */
export function ImportWizard() {
  const { project } = useProjectContext();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [onlyErrors, setOnlyErrors] = useState(false);
  const report = (job?.report ?? null) as Report | null;

  const upload = async (file: File) => {
    setBusy(true);
    setError("");
    const form = new FormData();
    form.append("file", file);
    const response = await fetch(`/api/v1/projects/${project.id}/imports`, {
      method: "POST",
      body: form,
      credentials: "same-origin",
      headers: { "X-CSRFToken": readCookie("csrftoken") ?? "" },
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setError(new ApiError(response.status, body).message);
    setJob(body as Job);
  };

  const patch = useMutation({
    mutationFn: (body: Schemas["PatchedImportUpdateRequest"]) => unwrap(api.PATCH("/api/v1/imports/{id}", { params: { path: { id: job!.id } }, body })),
    onSuccess: setJob,
  });
  const commit = useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/imports/{id}/commit", { params: { path: { id: job!.id } } })),
    onSuccess: (j) => {
      setJob(j);
      queryClient.invalidateQueries({ queryKey: projectKeys.sheets(project.id) });
      toast({ title: `${(j.report as unknown as Report).counts.ok} sheets imported` });
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === "import_has_errors") void patch.mutate({});
    },
  });
  const undo = useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/imports/{id}/undo", { params: { path: { id: job!.id } } })),
    onSuccess: (j) => {
      setJob(j);
      queryClient.invalidateQueries({ queryKey: projectKeys.sheets(project.id) });
      toast({ title: "Import undone", description: "The imported sheets were removed." });
    },
  });

  const fields = (job?.fields_available ?? []) as { key: string; label: string; required: boolean }[];
  const mapping = (job?.mapping ?? {}) as Record<string, number>;
  const skip = new Set((job?.skip_rows ?? []) as number[]);
  const overrides = (job?.overrides ?? {}) as Record<string, Record<string, string>>;
  const setMapping = (field: string, column: string) => {
    const next = { ...mapping };
    if (column === "") delete next[field];
    else next[field] = Number(column);
    patch.mutate({ mapping: next });
  };
  const toggleSkip = (index: number) => {
    const next = new Set(skip);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    patch.mutate({ skip_rows: [...next] });
  };
  const fix = (index: number, field: string, value: string) => {
    patch.mutate({ overrides: { ...overrides, [String(index)]: { ...(overrides[String(index)] ?? {}), [field]: value } } });
  };
  const mappedFields = fields.filter((f) => f.key in mapping);
  const shown = (report?.rows ?? []).filter((r) => !onlyErrors || r.status === "error");
  const commitError = commit.error instanceof ApiError ? commit.error.message : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-title font-semibold">Import register</h2>
        <a href="/api/v1/imports/template" className="inline-flex items-center gap-1.5 text-primary underline">
          <Download size={14} aria-hidden="true" /> Download template workbook
        </a>
      </div>

      {!job && (
        <Card title="1. Upload">
          <div className="flex flex-col gap-3 p-4">
            <p className="text-body text-muted">An Excel (.xlsx) or CSV file with one sheet per row. The first row holds the column names.</p>
            <label className="inline-flex h-9 w-fit cursor-pointer items-center gap-1.5 rounded-sm bg-primary px-3 font-semibold text-on-primary hover:bg-primary-hover">
              <FileSpreadsheet size={16} aria-hidden="true" />
              {busy ? "Reading…" : "Choose file"}
              <input type="file" accept=".xlsx,.csv" className="sr-only" disabled={busy} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            </label>
            {error && <p role="alert" className="text-small text-danger">{error}</p>}
          </div>
        </Card>
      )}

      {job && job.state === "preview" && report && (
        <>
          <Card title={`2. Match columns · ${job.original_name}`}>
            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {fields.map((f) => (
                <label key={f.key} className="flex flex-col gap-1 text-small">
                  <span className="font-semibold text-muted">{f.label}{f.required ? " *" : ""}</span>
                  <Select value={mapping[f.key] ?? ""} onChange={(e) => setMapping(f.key, e.target.value)}>
                    <option value="">Not in file</option>
                    {(job.headers as string[]).map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                  </Select>
                </label>
              ))}
            </div>
            {report.missing_columns.length > 0 && (
              <p role="alert" className="px-4 pb-4 text-small text-danger">Match these required columns: {report.missing_columns.join(", ")}.</p>
            )}
          </Card>

          <Card
            title={`3. Preview · ${report.counts.ok} ready · ${report.counts.error} with errors · ${report.counts.skipped} skipped`}
            actions={
              <label className="flex items-center gap-1.5 text-small">
                <input type="checkbox" checked={onlyErrors} onChange={(e) => setOnlyErrors(e.target.checked)} /> Errors only
              </label>
            }
          >
            <div className="max-h-[480px] overflow-auto" role="region" aria-label="Import preview" tabIndex={0}>
              <table className={tableClass}>
                <thead>
                  <tr>
                    <th scope="col" className={thClass}>Row</th>
                    {mappedFields.map((f) => <th key={f.key} scope="col" className={thClass}>{f.label}</th>)}
                    <th scope="col" className={thClass}>Problem</th>
                    <th scope="col" className={thClass}>Skip</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.index} style={r.status === "error" ? { background: "var(--danger-bg)" } : r.status === "skipped" ? { opacity: 0.6 } : undefined}>
                      <td className={`${tdClass} tabular`}>{r.row}</td>
                      {mappedFields.map((f) => (
                        <td key={f.key} className={tdClass}>
                          {r.status === "error" ? (
                            <TextInput aria-label={`Row ${r.row} ${f.label}`} className="h-7 min-w-28" defaultValue={r.values[f.key] ?? ""} onBlur={(e) => e.target.value !== (r.values[f.key] ?? "") && fix(r.index, f.key, e.target.value)} />
                          ) : (
                            r.values[f.key]
                          )}
                        </td>
                      ))}
                      <td className={`${tdClass} text-small whitespace-normal text-danger`}>{r.errors.join(" ")}</td>
                      <td className={tdClass}>
                        <input type="checkbox" aria-label={`Skip row ${r.row}`} checked={r.status === "skipped"} onChange={() => toggleSkip(r.index)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center gap-3 border-t border-border p-4">
              <Button variant="primary" busy={commit.isPending} disabled={report.counts.error > 0 || report.counts.ok === 0 || report.missing_columns.length > 0} onClick={() => commit.mutate()}>
                Import {report.counts.ok} sheets
              </Button>
              <span className="text-small text-muted">
                {report.counts.error > 0 ? "Fix or skip every row with an error. The import is all or nothing." : "Ready. You can undo the import for 24 hours."}
              </span>
              {commitError && <p role="alert" className="text-small text-danger">{commitError}</p>}
            </div>
          </Card>
        </>
      )}

      {job && job.state !== "preview" && (
        <Card title="4. Result">
          <div className="flex flex-col gap-3 p-4">
            <p className="text-body">
              {job.state === "committed"
                ? `${(job.created_sheet_ids as string[] | undefined)?.length ?? report?.counts.ok ?? 0} sheets imported from ${job.original_name}.`
                : `The import of ${job.original_name} was undone.`}
            </p>
            <div className="flex flex-wrap gap-2">
              <Link to={`/projects/${project.id}/register`} className="inline-flex h-9 items-center rounded-sm bg-primary px-3 font-semibold text-on-primary">Open register</Link>
              {job.state === "committed" && job.undo_until && (
                <Button icon={<Undo2 size={16} aria-hidden="true" />} busy={undo.isPending} onClick={() => undo.mutate()}>Undo import (until {formatDateTime(job.undo_until)})</Button>
              )}
            </div>
            {undo.error && <p role="alert" className="text-small text-danger">{undo.error.message}</p>}
          </div>
        </Card>
      )}
    </div>
  );
}
