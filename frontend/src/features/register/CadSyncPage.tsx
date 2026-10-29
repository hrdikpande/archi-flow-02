import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";

import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { Card, tableClass, tdClass, thClass } from "@/components/ui/PageHeader";
import { DataState, EmptyState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { useDisciplines, useStages } from "@/features/projects/api";
import { useProjectContext } from "@/features/projects/ProjectLayout";
import { api, type Schemas, unwrap } from "@/lib/api/client";
import { formatDateTime } from "@/lib/format";

type Proposal = Schemas["Proposal"];

const KIND: Record<string, string> = { new: "New sheet", title: "Title differs", revision: "Revision on title block differs" };

export const proposalsKey = (projectId: string) => ["projects", projectId, "cad-proposals"] as const;

export function useOpenProposals(projectId: string, enabled: boolean) {
  return useQuery({
    queryKey: proposalsKey(projectId),
    queryFn: () => unwrap(api.GET("/api/v1/projects/{project_pk}/cad-proposals", { params: { path: { project_pk: projectId } } })),
    enabled,
  });
}

/** F-09: sheets proposed by the Revit / AutoCAD plugin, side by side with the register. */
export function CadSyncPage() {
  const { project } = useProjectContext();
  const proposals = useOpenProposals(project.id, true);
  const rows = proposals.data ?? [];
  return (
    <Card title="CAD sync proposals" actions={<Link className="text-small text-primary underline" to="../register">Back to the register</Link>}>
      <p className="px-4 pt-3 text-small text-muted">
        Designers run “Sync sheets” in Revit or AutoCAD. Nothing changes in the register until a project or discipline lead accepts it here.
      </p>
      <DataState isPending={proposals.isPending} error={proposals.error} isEmpty={rows.length === 0} onRetry={() => proposals.refetch()} empty={<EmptyState message="No proposals waiting. The register matches the models." />}>
        <div className="overflow-x-auto" role="region" aria-label="Proposals" tabIndex={0}>
          <table className={tableClass}>
            <thead>
              <tr>
                <th scope="col" className={thClass}>Sheet</th>
                <th scope="col" className={thClass}>Proposal</th>
                <th scope="col" className={thClass}>In the register</th>
                <th scope="col" className={thClass}>In the model</th>
                <th scope="col" className={thClass}>From</th>
                <th scope="col" className={thClass}><span className="sr-only">Decide</span></th>
              </tr>
            </thead>
            <tbody>{rows.map((p) => <ProposalRow key={p.id} p={p} />)}</tbody>
          </table>
        </div>
      </DataState>
    </Card>
  );
}

function ProposalRow({ p }: { p: Proposal }) {
  const { project } = useProjectContext();
  const queryClient = useQueryClient();
  const toast = useToast();
  const stages = useStages(project.id);
  const disciplines = useDisciplines();
  const [stage, setStage] = useState(project.current_stage?.id ?? "");
  const [discipline, setDiscipline] = useState(p.discipline ?? "");
  const decide = useMutation({
    mutationFn: (accept: boolean) =>
      unwrap(api.POST("/api/v1/cad-proposals/{id}/decide", { params: { path: { id: p.id } }, body: { accept, stage: stage || null, discipline: discipline || null } })),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: proposalsKey(project.id) });
      queryClient.invalidateQueries({ queryKey: ["projects", project.id, "sheets"] });
      toast({ title: `${r.number}: ${r.state === "accepted" ? "accepted" : "rejected"}` });
    },
    onError: (e) => toast({ title: "Not possible", description: e.message }),
  });
  const advisory = p.kind === "revision";
  return (
    <tr>
      <td className={`${tdClass} mono font-semibold`}>{p.number}</td>
      <td className={tdClass}>{KIND[p.kind] ?? p.kind}</td>
      <td className={tdClass}>{p.kind === "new" ? "—" : p.kind === "title" ? p.register_title : p.register_revision || "—"}</td>
      <td className={tdClass}>
        {p.kind === "revision" ? p.cad_revision : p.cad_title}
        {p.kind === "new" && (
          <div className="mt-1 flex flex-wrap gap-1">
            <Select aria-label={`Discipline for ${p.number}`} className="h-8 w-36 text-small" value={discipline} onChange={(e) => setDiscipline(e.target.value)}>
              <option value="">Discipline…</option>
              {disciplines.data?.map((d) => <option key={d.id} value={d.id}>{d.code}</option>)}
            </Select>
            <Select aria-label={`Stage for ${p.number}`} className="h-8 w-44 text-small" value={stage} onChange={(e) => setStage(e.target.value)}>
              <option value="">Stage…</option>
              {stages.data?.map((s) => <option key={s.id} value={s.id}>{s.seq}. {s.name}</option>)}
            </Select>
          </div>
        )}
      </td>
      <td className={`${tdClass} text-small`}>{p.source === "revit" ? "Revit" : "AutoCAD"} · {p.sent_by}<span className="block text-muted">{formatDateTime(p.created_at)}</span></td>
      <td className={`${tdClass} whitespace-nowrap text-right`}>
        {advisory ? (
          <Button size="sm" onClick={() => decide.mutate(true)}>Noted</Button>
        ) : (
          <>
            <Button size="sm" variant="primary" busy={decide.isPending && decide.variables} onClick={() => decide.mutate(true)}>{p.kind === "new" ? "Add sheet" : "Use model title"}</Button>{" "}
            <Button size="sm" variant="ghost" onClick={() => decide.mutate(false)}>Reject</Button>
          </>
        )}
      </td>
    </tr>
  );
}
