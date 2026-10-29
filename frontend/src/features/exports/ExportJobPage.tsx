import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { useParams } from "react-router";

import { Card, PageHeader } from "@/components/ui/PageHeader";
import { DataState } from "@/components/ui/States";
import { api, unwrap } from "@/lib/api/client";
import { formatDateTime } from "@/lib/format";

/** Where the "export ready" email links: a fresh, short-lived download link on each visit. */
export function ExportJobPage() {
  const { exportId = "" } = useParams();
  const job = useQuery({
    queryKey: ["exports", exportId],
    queryFn: () => unwrap(api.GET("/api/v1/exports/{id}", { params: { path: { id: exportId } } })),
    refetchInterval: (q) => (q.state.data && ["queued", "running"].includes(q.state.data.state) ? 3000 : false),
  });
  const data = job.data;
  return (
    <>
      <PageHeader title="Export" meta={data && `${data.kind.replace(/_/g, " ")} · ${data.format === "xlsx" ? "Excel" : "PDF"} · requested ${formatDateTime(data.created_at)}`} />
      <Card>
        <DataState isPending={job.isPending} error={job.error} isEmpty={false} empty={null} onRetry={() => job.refetch()}>
          {data && (
            <div className="flex flex-col items-start gap-2 p-4" role="status">
              {data.state === "done" && data.download_url ? (
                <>
                  <p className="text-body">{data.row_count.toLocaleString("en-IN")} rows · finished {formatDateTime(data.finished_at)}</p>
                  <a href={data.download_url} className="inline-flex h-9 items-center gap-2 rounded-sm bg-primary px-3 font-semibold text-on-primary hover:bg-primary-hover">
                    <Download size={16} aria-hidden="true" /> Download {data.file_name}
                  </a>
                  <p className="text-small text-muted">The link works for 5 minutes; reload this page for a new one.</p>
                </>
              ) : data.state === "failed" ? (
                <p className="text-body text-danger">The export failed: {data.error}</p>
              ) : (
                <p className="text-body">Preparing {data.row_count.toLocaleString("en-IN")} rows… this page updates by itself.</p>
              )}
            </div>
          )}
        </DataState>
      </Card>
    </>
  );
}
