import { Link } from "react-router";

import { Card, tableClass, tdClass, thClass } from "@/components/ui/PageHeader";
import { StageChip } from "@/components/ui/StageChip";
import { DataState, EmptyState } from "@/components/ui/States";
import { ProjectDashboard } from "@/features/dashboards/ProjectDashboard";
import { RiskCard } from "@/features/intelligence/RiskCard";
import { formatDate } from "@/lib/format";

import { PROJECT_TYPES, useStages } from "./api";
import { useProjectContext } from "./ProjectLayout";

/** S-04 Project overview: dashboard cards (D-02), project facts and stage timeline. */
export function ProjectFacts() {
  const { project } = useProjectContext();
  const stages = useStages(project.id);
  return (
    <div className="flex flex-col gap-4">
    <ProjectDashboard projectId={project.id} />
    {project.my_permissions.view_forecasts && <RiskCard projectId={project.id} />}
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Project">
        <dl className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-2 p-4 text-body">
          <dt className="text-muted">Client</dt><dd>{project.client_name ?? "—"}</dd>
          <dt className="text-muted">Type</dt><dd>{PROJECT_TYPES.find((t) => t.value === project.type)?.label}</dd>
          <dt className="text-muted">Location</dt><dd>{project.location || "—"}</dd>
          <dt className="text-muted">Dates</dt><dd>{project.start_date ? `${formatDate(project.start_date)} → ${formatDate(project.end_date) || "…"}` : "—"}</dd>
          <dt className="text-muted">CAD versions</dt><dd>{(project.cad_versions ?? []).join(", ") || "—"}</dd>
          <dt className="text-muted">Stage plan</dt><dd>{project.stage_plan_final ? "Final" : "Draft"}</dd>
        </dl>
      </Card>
      <Card title="Stage timeline">
        <DataState
          isPending={stages.isPending}
          error={stages.error}
          isEmpty={(stages.data ?? []).length === 0}
          empty={<EmptyState message="No fee stages yet." action={project.my_permissions.edit_project && <Link className="text-primary underline" to="stages">Set up stages</Link>} />}
        >
          <table className={tableClass}>
            <thead>
              <tr>
                <th scope="col" className={thClass}>Stage</th>
                <th scope="col" className={thClass}>Planned</th>
                <th scope="col" className={thClass}>State</th>
              </tr>
            </thead>
            <tbody>
              {(stages.data ?? []).map((s) => (
                <tr key={s.id} className={project.current_stage?.id === s.id ? "bg-surface-muted font-semibold" : undefined}>
                  <td className={tdClass}>{s.seq}. {s.name}</td>
                  <td className={`${tdClass} text-small`}>{s.planned_start ? `${formatDate(s.planned_start)} → ${formatDate(s.planned_end)}` : "—"}</td>
                  <td className={tdClass}><StageChip state={s.state} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </Card>
    </div>
    </div>
  );
}
