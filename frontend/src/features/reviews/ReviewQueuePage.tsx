import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { Button } from "@/components/ui/Button";
import { Card, PageHeader, tableClass, tdClass, thClass } from "@/components/ui/PageHeader";
import { PdfViewer } from "@/components/ui/PdfViewer";
import { DataState, EmptyState } from "@/components/ui/States";
import type { SheetState } from "@/components/ui/status";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { api, type Schemas, unwrap } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import { uploadFile } from "@/lib/upload";
import { PrecheckPanel } from "@/features/sheets/ActionBar";
import { useRevisionLink } from "@/features/sheets/api";

import { DelegationButton } from "./Delegation";

type QueueItem = Schemas["QueueItem"];

const KIND_LABEL: Record<string, string> = {
  ready_for_check: "Waiting to start",
  check: "In your check",
  senior_qc: "Senior QC",
};

export function useReviewQueue() {
  return useQuery({ queryKey: ["reviews"], queryFn: () => unwrap(api.GET("/api/v1/reviews")) });
}

/** S-08 Review queue (F-11; F-12 adds delegation in P2). */
export function ReviewQueuePage() {
  const queue = useReviewQueue();
  const [open, setOpen] = useState<QueueItem | null>(null);
  const items = queue.data ?? [];

  return (
    <>
      <PageHeader
        title="Reviews"
        meta="Sheets waiting for your check, oldest first. Waiting time is in working days."
        actions={<DelegationButton />}
      />
      {open ? (
        <ReviewPanel item={open} onClose={() => setOpen(null)} />
      ) : (
        <Card>
          <DataState isPending={queue.isPending} error={queue.error} isEmpty={items.length === 0} onRetry={() => queue.refetch()} empty={<EmptyState message="Nothing is waiting for your check." />}>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th scope="col" className={thClass}>Sheet</th>
                  <th scope="col" className={thClass}>Project</th>
                  <th scope="col" className={thClass}>Designer</th>
                  <th scope="col" className={thClass}>Waiting</th>
                  <th scope="col" className={thClass}>Stage</th>
                  <th scope="col" className={thClass}>Senior QC</th>
                  <th scope="col" className={thClass}>Step</th>
                  <th scope="col" className={thClass}><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={`${item.kind}-${item.sheet.id}`}>
                    <td className={tdClass}>
                      <span className="mono font-semibold">{item.sheet.number}</span> {item.sheet.title}
                    </td>
                    <td className={tdClass}><span className="mono">{item.project_code}</span></td>
                    <td className={tdClass}>
                      {item.sheet.owner_detail?.short_name ?? "—"}
                      {item.delegated_from && <span className="block text-small text-muted">for {item.delegated_from.short_name}</span>}
                    </td>
                    <td className={`${tdClass} tabular`}>{item.working_days_waiting} {item.working_days_waiting === 1 ? "day" : "days"} <span className="text-small text-muted">since {formatDate(item.waiting_since)}</span></td>
                    <td className={tdClass}>{item.sheet.stage_name}</td>
                    <td className={tdClass}>{item.senior_qc_needed ? "Needed" : "—"}</td>
                    <td className={tdClass}>{KIND_LABEL[item.kind]}</td>
                    <td className={`${tdClass} text-right`}><Button size="sm" variant="primary" onClick={() => setOpen(item)}>Open</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataState>
        </Card>
      )}
    </>
  );
}

function ReviewPanel({ item, onClose }: { item: QueueItem; onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [comment, setComment] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const revisions = useQuery({
    queryKey: ["sheet", item.sheet.id, "revisions"],
    queryFn: () => unwrap(api.GET("/api/v1/sheets/{id}/revisions", { params: { path: { id: item.sheet.id } } })),
  });
  const draft = revisions.data?.find((r) => r.state === "draft" && r.has_file) ?? revisions.data?.find((r) => r.has_file);

  const link = useRevisionLink(draft?.id).data ?? null;

  const act = useMutation({
    mutationFn: async (action: "start_check" | "approve" | "return") => {
      const redline_upload_ids: string[] = [];
      for (const f of files) redline_upload_ids.push((await uploadFile(f, f.type.startsWith("image/") ? "image" : "document")).id);
      return unwrap(api.POST("/api/v1/sheets/{id}/transitions", { params: { path: { id: item.sheet.id } }, body: { action, comment, redline_upload_ids } }));
    },
    onSuccess: (sheet, action) => {
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
      queryClient.invalidateQueries({ queryKey: ["sheet", item.sheet.id] });
      if (action === "start_check") {
        toast({ title: `${sheet.number}: check started` });
        return;
      }
      toast({ title: `${sheet.number} ${action === "approve" ? (sheet.state === "in_check" ? "approved; senior QC is next" : "approved for issue") : "returned to the designer"}` });
      onClose();
    },
    onError: (e) => setError(e.message),
  });
  const started = item.kind !== "ready_for_check" || act.data?.state === "in_check";

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <PdfViewer url={link?.url ?? null} filename={`${item.sheet.number} ${draft?.code ?? ""}`} />
      <Card title={`${item.sheet.number} · ${item.sheet.title}`}>
        <div className="flex flex-col gap-3 p-4">
          <p className="flex flex-wrap items-center gap-2 text-small text-muted">
            <StatusChip state={(act.data?.state ?? item.sheet.state) as SheetState} /> {item.project_code} · {item.sheet.owner_detail?.short_name}
            <Link className="text-primary underline" to={`/projects/${item.sheet.project}/sheets/${item.sheet.id}`}>Open sheet</Link>
          </p>
          {item.delegated_from && <p className="text-small text-muted">Covering for {item.delegated_from.full_name} (delegation)</p>}
          <PrecheckPanel sheetId={item.sheet.id} state={act.data?.state ?? item.sheet.state} />
          {error && <p role="alert" className="text-small text-danger">{error}</p>}
          {!started ? (
            <Button variant="primary" busy={act.isPending} onClick={() => act.mutate("start_check")}>Start check</Button>
          ) : (
            <>
              <label htmlFor="review-comment" className="text-small font-semibold text-muted">Comment</label>
              <textarea id="review-comment" rows={5} className="rounded-sm border border-border bg-surface p-2" value={comment} onChange={(e) => setComment(e.target.value)} />
              <label className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-sm border border-border px-3 py-1.5 text-body hover:bg-surface-muted">
                <Upload size={14} aria-hidden="true" /> {files.length ? `${files.length} redline file(s)` : "Attach redlines"}
                <input type="file" multiple accept="application/pdf,image/jpeg,image/png" className="sr-only" onChange={(e) => setFiles([...(e.target.files ?? [])])} />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" busy={act.isPending && act.variables === "approve"} onClick={() => act.mutate("approve")}>Approve</Button>
                <Button busy={act.isPending && act.variables === "return"} disabled={!comment.trim() && files.length === 0} onClick={() => act.mutate("return")}>Return with redlines</Button>
              </div>
            </>
          )}
          <Button variant="ghost" onClick={onClose}>Back to the queue</Button>
        </div>
      </Card>
    </div>
  );
}
