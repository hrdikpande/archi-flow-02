import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ScanSearch } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { api, type Schemas, unwrap } from "@/lib/api/client";

type Finding = Schemas["Finding"];

export function useReviewFinding(invalidate: unknown[]) {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) => unwrap(api.POST("/api/v1/findings/{id}/review", { params: { path: { id } }, body: { accept } })),
    onSuccess: (f) => {
      queryClient.invalidateQueries({ queryKey: invalidate });
      toast({ title: f.status === "accepted" ? "Finding accepted" : "Marked as a false alarm" });
    },
  });
}

export function FindingRow({ f, review }: { f: Finding; review: ReturnType<typeof useReviewFinding> }) {
  return (
    <li className="flex flex-col gap-1 rounded-sm border border-border p-2">
      <p className="text-body"><span className="mono text-small text-muted">{f.sheet_number} {f.revision_code} · {f.rule}</span> {f.message}</p>
      {f.status === "open" ? (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => review.mutate({ id: f.id, accept: true })}>Correct</Button>
          <Button size="sm" variant="ghost" onClick={() => review.mutate({ id: f.id, accept: false })}>False alarm</Button>
        </div>
      ) : (
        <p className="text-small text-muted">{f.status === "accepted" ? "Accepted" : "Rejected"} by {f.reviewed_by_detail?.short_name}</p>
      )}
    </li>
  );
}

/** F-57 findings on the sheet page (only once the firm has turned drawing checks on). */
export function FindingsPanel({ sheetId }: { sheetId: string }) {
  const key = ["sheet", sheetId, "findings"];
  const findings = useQuery({ queryKey: key, queryFn: () => unwrap(api.GET("/api/v1/sheets/{id}/findings", { params: { path: { id: sheetId } } })) });
  const review = useReviewFinding(key);
  const rows = findings.data ?? [];
  if (rows.length === 0) return null;
  return (
    <section aria-label="Drawing check findings" className="rounded-md border border-border p-3">
      <h3 className="mb-1 flex items-center gap-1.5 text-body font-semibold"><ScanSearch size={16} aria-hidden="true" /> Drawing checks</h3>
      <p className="mb-2 text-small text-muted">Advisory: rules found these on the issued PDF. They never block an issue.</p>
      <ul className="flex flex-col gap-2">{rows.map((f) => <FindingRow key={f.id} f={f} review={review} />)}</ul>
    </section>
  );
}
