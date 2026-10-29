import { useQuery } from "@tanstack/react-query";

import { Card, PageHeader } from "@/components/ui/PageHeader";
import { DataState, EmptyState } from "@/components/ui/States";
import { api, unwrap } from "@/lib/api/client";

import { FindingRow, useReviewFinding } from "./FindingsPanel";

/** F-57 labelling queue: leads mark each finding correct or a false alarm (evaluation before rollout). */
export function FindingsQueuePage() {
  const key = ["intelligence", "findings"];
  const findings = useQuery({ queryKey: key, queryFn: () => unwrap(api.GET("/api/v1/intelligence/findings")) });
  const review = useReviewFinding(key);
  const rows = findings.data ?? [];
  return (
    <>
      <PageHeader title="Drawing check findings" meta="Mark each as correct or a false alarm. The firm turns checks on for everyone after 200 sheets are labelled." />
      <Card>
        <DataState isPending={findings.isPending} error={findings.error} isEmpty={rows.length === 0} onRetry={() => findings.refetch()} empty={<EmptyState message="Nothing to label." />}>
          <ul className="flex flex-col gap-2 p-4">{rows.map((f) => <FindingRow key={f.id} f={f} review={review} />)}</ul>
        </DataState>
      </Card>
    </>
  );
}
