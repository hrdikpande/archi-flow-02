import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileSpreadsheet, Upload } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Card, PageHeader, tableClass, tdClass, thClass } from "@/components/ui/PageHeader";
import { DataState, EmptyState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, readCookie, type Schemas, unwrap } from "@/lib/api/client";
import { formatDateTime } from "@/lib/format";
import { uploadFile } from "@/lib/upload";

type Job = Schemas["OnboardingJob"];

/** F-54: load a live project from the template workbook and a folder of PDFs (Admin). */
export function OnboardingSettings() {
  const queryClient = useQueryClient();
  const jobs = useQuery({ queryKey: ["onboarding"], queryFn: () => unwrap(api.GET("/api/v1/onboarding")) });
  const [current, setCurrent] = useState<Job | null>(null);
  const [error, setError] = useState<string>();
  const start = useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/v1/onboarding", { method: "POST", body, credentials: "same-origin", headers: { "X-CSRFToken": readCookie("csrftoken") ?? "" } });
      const data = await res.json();
      if (!res.ok) throw new ApiError(res.status, data);
      return data as Job;
    },
    onSuccess: (job) => {
      setCurrent(job);
      queryClient.invalidateQueries({ queryKey: ["onboarding"] });
    },
    onError: (e) => setError(e.message),
  });

  return (
    <>
      <PageHeader title="Onboarding" meta="Load a live project: its stages, team, sheets and past revisions. Nothing is emailed during the load." />
      <div className="flex flex-col gap-4">
        <Card title="1. Fill in the template">
          <div className="flex flex-wrap items-center gap-3 p-4">
            <a href="/api/v1/imports/template" className="inline-flex items-center gap-2 text-primary underline">
              <FileSpreadsheet size={16} aria-hidden="true" /> Download the template workbook
            </a>
            <span className="text-small text-muted">Fill in every sheet: Project, Stages, Team, Packages, Sheets and Revisions.</span>
          </div>
        </Card>
        <Card title="2. Upload the workbook">
          <div className="flex flex-col gap-2 p-4">
            <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-sm border border-border px-3 py-2 hover:bg-surface-muted">
              <Upload size={16} aria-hidden="true" /> Choose .xlsx
              <input
                type="file"
                accept=".xlsx"
                className="sr-only"
                onChange={(e) => {
                  setError(undefined);
                  const f = e.target.files?.[0];
                  if (f) start.mutate(f);
                  e.target.value = "";
                }}
              />
            </label>
            {start.isPending && <p className="text-small text-muted">Reading the workbook…</p>}
            {error && <p role="alert" className="text-small text-danger">{error}</p>}
          </div>
        </Card>
        {current && <OnboardingJobCard key={current.id} job={current} onChange={setCurrent} />}
        <Card title="Earlier loads">
          <DataState isPending={jobs.isPending} error={jobs.error} isEmpty={(jobs.data ?? []).length === 0} onRetry={() => jobs.refetch()} empty={<EmptyState message="No projects loaded yet." />}>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th scope="col" className={thClass}>Workbook</th>
                  <th scope="col" className={thClass}>Project</th>
                  <th scope="col" className={thClass}>State</th>
                  <th scope="col" className={thClass}>When</th>
                </tr>
              </thead>
              <tbody>
                {(jobs.data ?? []).map((j) => (
                  <tr key={j.id}>
                    <td className={tdClass}><button type="button" className="text-primary underline" onClick={() => setCurrent(j)}>{j.original_name}</button></td>
                    <td className={tdClass}><span className="mono">{j.project_code}</span> {j.project_name}</td>
                    <td className={tdClass}>{j.state === "committed" ? "Loaded" : j.report.ready ? "Ready to load" : "Needs fixes"}</td>
                    <td className={tdClass}>{formatDateTime(j.committed_at ?? j.created_at)}</td>
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

function OnboardingJobCard({ job, onChange }: { job: Job; onChange: (j: Job) => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<{ done: number; total: number; failed: string[] } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const report = job.report;
  const committed = job.state === "committed";

  const attach = async (files: FileList) => {
    const list = [...files].filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    const ids: string[] = [];
    const failed: string[] = [];
    setProgress({ done: 0, total: list.length, failed });
    for (const [i, f] of list.entries()) {
      try {
        ids.push((await uploadFile(f, "document")).id);
      } catch (e) {
        failed.push(`${f.name}: ${(e as Error).message}`);
      }
      setProgress({ done: i + 1, total: list.length, failed: [...failed] });
    }
    if (ids.length) {
      const updated = await unwrap(api.POST("/api/v1/onboarding/{id}/files", { params: { path: { id: job.id } }, body: { uploads: ids } }));
      onChange(updated);
    }
  };
  const commit = useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/onboarding/{id}/commit", { params: { path: { id: job.id } } })),
    onSuccess: (j) => {
      setConfirming(false);
      onChange(j);
      queryClient.invalidateQueries({ queryKey: ["onboarding"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast({ title: `${j.project_code} loaded`, description: `${report.counts.sheets ?? 0} sheets and ${report.counts.revisions ?? 0} revisions.` });
    },
    onError: (e) => {
      setConfirming(false);
      toast({ title: "Not loaded", description: e.message });
    },
  });

  return (
    <Card title={`3. Check and load · ${job.project_code} ${job.project_name}`}>
      <div className="flex flex-col gap-4 p-4">
        <p className="text-body">
          {Object.entries(report.counts).map(([k, v]) => `${v} ${k}`).join(" · ")}
        </p>
        {committed ? (
          <p role="status" className="flex items-center gap-2 text-body">
            <CheckCircle2 size={16} aria-hidden="true" style={{ color: "var(--state-issued-fg)" }} /> Loaded {formatDateTime(job.committed_at)}.
            {job.project && <Link className="text-primary underline" to={`/projects/${job.project}/register`}>Open the register</Link>}
          </p>
        ) : (
          <>
            {report.errors.length > 0 && (
              <div>
                <h3 className="mb-1 text-body font-semibold">{report.errors.length} problem{report.errors.length === 1 ? "" : "s"} to fix in the workbook</h3>
                <ul className="max-h-60 list-disc overflow-y-auto pl-5 text-small">
                  {report.errors.map((e, i) => <li key={i}>{e.sheet}{e.row ? ` row ${e.row}` : ""}: {e.message}</li>)}
                </ul>
                <p className="mt-1 text-small text-muted">Fix them and upload the workbook again.</p>
              </div>
            )}
            {report.missing_files.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-body font-semibold">{report.missing_files.length} PDF{report.missing_files.length === 1 ? "" : "s"} still needed</h3>
                <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-sm border border-border px-3 py-2 hover:bg-surface-muted">
                  <Upload size={16} aria-hidden="true" /> Choose PDFs
                  <input type="file" accept="application/pdf" multiple className="sr-only" onChange={(e) => e.target.files && attach(e.target.files)} />
                </label>
                {progress && <p className="text-small text-muted" role="status">Uploaded {progress.done} of {progress.total}</p>}
                {progress?.failed.map((f) => <p key={f} className="text-small text-danger">{f}</p>)}
                <details>
                  <summary className="cursor-pointer text-small">Show file names</summary>
                  <ul className="mt-1 max-h-40 overflow-y-auto text-small mono">{report.missing_files.map((f) => <li key={f}>{f}</li>)}</ul>
                </details>
              </div>
            )}
            <div>
              <Button variant="primary" disabled={!report.ready} onClick={() => setConfirming(true)}>Load project</Button>
              {!report.ready && <span className="ml-2 text-small text-muted">Fix the problems and add the PDFs first.</span>}
            </div>
          </>
        )}
      </div>
      <ConfirmDialog open={confirming} onOpenChange={setConfirming} title={`Load ${job.project_code}?`} confirmLabel="Load project" busy={commit.isPending} onConfirm={() => commit.mutate()}>
        Creates the project with {report.counts.stages ?? 0} stages, {report.counts.sheets ?? 0} sheets and {report.counts.revisions ?? 0} past revisions. Past revisions keep their original dates. No one is notified.
      </ConfirmDialog>
    </Card>
  );
}
