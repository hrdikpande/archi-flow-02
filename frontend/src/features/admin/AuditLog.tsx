import { useInfiniteQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { Card, PageHeader, tableClass, tdClass, thClass } from "@/components/ui/PageHeader";
import { DataState, EmptyState } from "@/components/ui/States";
import { api, type Schemas, unwrap } from "@/lib/api/client";
import { cursorFrom } from "@/lib/api/cursor";
import { formatDateTime } from "@/lib/format";

type Event = Schemas["AuditEvent"];

function describeChange(e: Event): string {
  const after = (e.after ?? {}) as Record<string, unknown>;
  const before = (e.before ?? {}) as Record<string, unknown>;
  const keys = Object.keys({ ...before, ...after });
  if (!e.before && e.after) return "Created";
  if (e.before && !e.after) return "Deleted";
  return keys
    .slice(0, 4)
    .map((k) => `${k}: ${JSON.stringify(before[k] ?? "")} → ${JSON.stringify(after[k] ?? "")}`)
    .join("; ");
}

/** F-39: who changed what, when, from where. Owner and Admin can export it. */
export function AuditLog() {
  const [verb, setVerb] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const filters = { verb: verb || undefined, date_from: from || undefined, date_to: to || undefined };
  const query = useInfiniteQuery({
    queryKey: ["audit", filters],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => unwrap(api.GET("/api/v1/audit", { params: { query: { ...filters, cursor: pageParam } } })),
    getNextPageParam: (last) => cursorFrom(last.next),
  });
  const events = query.data?.pages.flatMap((p) => p.results) ?? [];
  const exportUrl = `/api/v1/audit/export?${new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][])}`;

  return (
    <>
      <PageHeader
        title="Audit trail"
        meta="Every change, with who made it, when, the values before and after, and the request it came from. Rows cannot be edited or deleted."
        actions={
          <a href={exportUrl} className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-border bg-surface px-3 font-semibold hover:bg-surface-muted">
            <Download size={16} aria-hidden="true" />
            Export CSV
          </a>
        }
      />
      <Card>
        <div className="flex flex-wrap items-end gap-3 border-b border-border p-4">
          <Field label="Action starts with" hint="e.g. discipline, contact, auth">
            {(a) => <TextInput {...a} value={verb} onChange={(e) => setVerb(e.target.value)} />}
          </Field>
          <Field label="From">{(a) => <TextInput {...a} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />}</Field>
          <Field label="To">{(a) => <TextInput {...a} type="date" value={to} onChange={(e) => setTo(e.target.value)} />}</Field>
        </div>
        <DataState
          isPending={query.isPending}
          error={query.error}
          isEmpty={events.length === 0}
          onRetry={() => query.refetch()}
          empty={<EmptyState message="No changes match these filters." />}
        >
          {/* Scrollable regions must be keyboard reachable (WCAG 2.1.1). */}
          <div className="overflow-x-auto" role="region" aria-label="Audit events" tabIndex={0}>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th scope="col" className={thClass}>When</th>
                  <th scope="col" className={thClass}>Who</th>
                  <th scope="col" className={thClass}>Action</th>
                  <th scope="col" className={thClass}>Record</th>
                  <th scope="col" className={thClass}>Change</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id}>
                    <td className={`${tdClass} whitespace-nowrap`}>{formatDateTime(e.at)}</td>
                    <td className={tdClass}>{e.actor_label}</td>
                    <td className={tdClass}><span className="mono text-small">{e.verb}</span></td>
                    <td className={tdClass}>{e.entity_label}</td>
                    <td className={`${tdClass} max-w-md truncate text-small text-muted`} title={describeChange(e)}>
                      {describeChange(e)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {query.hasNextPage && (
            <div className="p-3">
              <Button size="sm" busy={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>Show more</Button>
            </div>
          )}
        </DataState>
      </Card>
    </>
  );
}
