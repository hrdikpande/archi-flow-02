import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Link, useSearchParams } from "react-router";

import { TextInput } from "@/components/ui/Field";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { Card, PageHeader } from "@/components/ui/PageHeader";
import { DataState, EmptyState } from "@/components/ui/States";
import { api, unwrap } from "@/lib/api/client";

const KINDS = [
  { value: "decision", label: "Decisions" },
  { value: "comment", label: "Client comments" },
  { value: "rfi", label: "RFIs" },
  { value: "review", label: "Review comments" },
  { value: "observation", label: "Site observations" },
  { value: "change_order", label: "Change orders" },
  { value: "clash", label: "Clash issues" },
];

/** S-22 knowledge search (F-58): past decisions, comments, RFIs and reviews across projects. */
export function KnowledgePage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const kinds = params.getAll("kind");
  const results = useQuery({
    queryKey: ["knowledge", q, kinds],
    queryFn: () => unwrap(api.GET("/api/v1/knowledge/search", { params: { query: { q, kind: kinds.length ? kinds : undefined } } })),
    enabled: q.trim().length >= 2,
  });
  const set = (k: string, v: string | string[]) => {
    const next = new URLSearchParams(params);
    next.delete(k);
    for (const x of Array.isArray(v) ? v : [v]) if (x) next.append(k, x);
    setParams(next, { replace: true });
  };
  const rows = results.data ?? [];
  return (
    <>
      <PageHeader title="Knowledge" meta="What was decided, asked and answered before, on every project you can see." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-lg">
          <Search size={16} aria-hidden="true" className="absolute top-1/2 left-2.5 -translate-y-1/2 text-muted" />
          <TextInput aria-label="Search knowledge" placeholder="e.g. OT ceiling HEPA" className="pl-8" value={q} onChange={(e) => set("q", e.target.value)} />
        </div>
        <MultiSelect label="Type" options={KINDS} value={kinds} onChange={(v) => set("kind", v)} />
      </div>
      <Card>
        {q.trim().length < 2 ? (
          <EmptyState message="Type at least two letters." />
        ) : (
          <DataState isPending={results.isPending} error={results.error} isEmpty={rows.length === 0} onRetry={() => results.refetch()} empty={<EmptyState message="Nothing found. Try fewer or different words." />}>
            <ul className="divide-y divide-border">
              {rows.map((h) => (
                <li key={`${h.kind}-${h.id}`} className="px-4 py-3">
                  <Link to={h.link} className="font-semibold text-primary hover:underline">{h.title}</Link>
                  <p className="text-small text-muted">{h.kind_label} · <span className="mono">{h.project_code}</span>{h.sheets.length > 0 && <> · <span className="mono">{h.sheets.map((s) => s.number).join(", ")}</span></>}</p>
                  {h.snippet && <p className="mt-1 text-body">{h.snippet}</p>}
                </li>
              ))}
            </ul>
          </DataState>
        )}
      </Card>
      <p className="mt-3 text-small text-muted">Reusable checklists live in Admin › Checklists; stage templates in Admin › Stage templates.</p>
    </>
  );
}
