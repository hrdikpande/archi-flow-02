import { useInfiniteQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { Link } from "react-router";

import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Dialog";
import { Select, TextInput } from "@/components/ui/Field";
import { Card, PageHeader, tableClass, tdClass, thClass } from "@/components/ui/PageHeader";
import { StageChip } from "@/components/ui/StageChip";
import { DataState, EmptyState } from "@/components/ui/States";
import { api, unwrap } from "@/lib/api/client";
import { cursorFrom } from "@/lib/api/cursor";
import type { Me } from "@/lib/auth/useMe";

import { ROLE_LABELS } from "./api";
import { NewProjectForm } from "./NewProjectForm";

export function ProjectsPage({ me }: { me: Me }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("active");
  const [creating, setCreating] = useState(false);
  const search = useDeferredValue(q.trim());
  const query = useInfiniteQuery({
    queryKey: ["projects", { search, status }],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      unwrap(api.GET("/api/v1/projects", { params: { query: { q: search || undefined, status: status || undefined, cursor: pageParam } } })),
    getNextPageParam: (last) => cursorFrom(last.next),
  });
  const projects = query.data?.pages.flatMap((p) => p.results) ?? [];
  const canCreate = me.capabilities.create_project;

  return (
    <>
      <PageHeader
        title="Projects"
        actions={canCreate && <Button variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => setCreating(true)}>New project</Button>}
      />
      <div className="mb-3 flex flex-wrap gap-3">
        <div className="relative w-72 max-w-full">
          <Search size={16} aria-hidden="true" className="pointer-events-none absolute top-2.5 left-2.5 text-muted" />
          <TextInput aria-label="Search projects" placeholder="Code or name" className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select aria-label="Status" className="w-40" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="active">Active</option>
          <option value="on_hold">On hold</option>
          <option value="closed">Closed</option>
          <option value="">All</option>
        </Select>
      </div>
      <Card>
        <DataState
          isPending={query.isPending}
          error={query.error}
          isEmpty={projects.length === 0}
          onRetry={() => query.refetch()}
          empty={
            <EmptyState
              message={search ? `No projects match “${search}”.` : "No projects yet."}
              action={canCreate && !search && <Button variant="primary" onClick={() => setCreating(true)}>New project</Button>}
            />
          }
        >
          <table className={tableClass}>
            <thead>
              <tr>
                <th scope="col" className={thClass}>Project</th>
                <th scope="col" className={thClass}>Client</th>
                <th scope="col" className={thClass}>Stage</th>
                <th scope="col" className={thClass}>Lead</th>
                <th scope="col" className={thClass}>Your role</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="hover:bg-surface-muted">
                  <td className={tdClass}>
                    <Link to={`/projects/${p.id}`} className="text-primary hover:underline">
                      <span className="mono font-semibold">{p.code}</span> {p.name}
                    </Link>
                  </td>
                  <td className={tdClass}>{p.client_name ?? "—"}</td>
                  <td className={tdClass}>{p.current_stage ? <span className="flex items-center gap-2">{p.current_stage.seq} {p.current_stage.name} <StageChip state={p.current_stage.state} /></span> : <span className="text-muted">No stages</span>}</td>
                  <td className={tdClass}>{p.lead?.short_name ?? "—"}</td>
                  <td className={tdClass}>{p.my_role ? ROLE_LABELS[p.my_role] : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {query.hasNextPage && (
            <div className="p-3"><Button size="sm" busy={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>Show more</Button></div>
          )}
        </DataState>
      </Card>
      <Drawer open={creating} onOpenChange={setCreating} title="New project">
        {creating && <NewProjectForm me={me} onDone={() => setCreating(false)} />}
      </Drawer>
    </>
  );
}
