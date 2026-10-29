import * as Menu from "@radix-ui/react-dropdown-menu";
import { useMutation } from "@tanstack/react-query";
import { ChevronDown, Download } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { api, type Schemas, unwrap } from "@/lib/api/client";

type Kind = Schemas["ExportKindEnum"];

/** URL params → export filters: repeated keys become lists (discipline=a&discipline=b). */
export function paramsToFilters(params?: URLSearchParams): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!params) return out;
  for (const key of new Set(params.keys())) {
    const values = params.getAll(key).filter(Boolean);
    if (values.length === 0) continue;
    out[key] = values.length === 1 && !["discipline", "stage", "state", "owner", "package", "checker", "flag", "project"].includes(key) ? values[0] : values;
  }
  return out;
}

/** F-52: "Every list view has Export with the current filters". Up to 5,000 rows download
 * straight away; larger exports run in the background and the person gets an email link. */
export function ExportButton({ kind, projectId, params }: { kind: Kind; projectId?: string; params?: URLSearchParams }) {
  const toast = useToast();
  const start = useMutation({
    mutationFn: (format: "xlsx" | "pdf") =>
      unwrap(api.POST("/api/v1/exports", { body: { kind, format, project: projectId ?? null, filters: paramsToFilters(params) } })),
    onSuccess: (job) => {
      if (job.state === "done" && job.download_url) {
        window.location.assign(job.download_url);
        toast({ title: `Exported ${job.row_count} row${job.row_count === 1 ? "" : "s"}` });
      } else if (job.state === "failed") {
        toast({ title: "Export failed", description: job.error });
      } else {
        toast({ title: `Preparing ${job.row_count.toLocaleString("en-IN")} rows`, description: "We'll email you a link when the file is ready." });
      }
    },
    onError: (e) => toast({ title: "Export not possible", description: e.message }),
  });
  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Button busy={start.isPending} icon={<Download size={16} aria-hidden="true" />}>
          Export <ChevronDown size={14} aria-hidden="true" />
        </Button>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="end" sideOffset={4} className="z-50 min-w-40 rounded-md border border-border bg-surface p-1 shadow-overlay">
          <Menu.Item className="cursor-pointer rounded-sm px-3 py-1.5 text-body outline-none data-[highlighted]:bg-surface-muted" onSelect={() => start.mutate("xlsx")}>
            Excel (.xlsx)
          </Menu.Item>
          <Menu.Item className="cursor-pointer rounded-sm px-3 py-1.5 text-body outline-none data-[highlighted]:bg-surface-muted" onSelect={() => start.mutate("pdf")}>
            PDF
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
