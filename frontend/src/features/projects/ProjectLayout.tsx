import { NavLink, Outlet, useOutletContext, useParams } from "react-router";

import { StageChip } from "@/components/ui/StageChip";
import { ErrorState, SkeletonRows } from "@/components/ui/States";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/cn";

import { type Project, useProject } from "./api";

export interface ProjectContext {
  project: Project;
}

export function useProjectContext(): ProjectContext {
  return useOutletContext<ProjectContext>();
}

/** Project tabs (DESIGN.md §3): Overview · Register · Stages · Transmittals · Team & hours · Activity. */
const TABS = [
  { to: "", label: "Overview", end: true },
  { to: "register", label: "Register" },
  { to: "stages", label: "Stages" },
  { to: "transmittals", label: "Transmittals" },
  { to: "team", label: "Team & hours" },
  { to: "activity", label: "Activity" },
  { to: "comments", label: "Comments" },
  { to: "construction", label: "Construction" },
  { to: "decisions", label: "Decisions" },
];

export function ProjectLayout() {
  const { projectId = "" } = useParams();
  const query = useProject(projectId);
  if (query.isPending) return <SkeletonRows label="Loading project" />;
  if (query.error) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return <ErrorState message={notFound ? "This project does not exist or you are not on its team." : query.error.message} onRetry={notFound ? undefined : () => query.refetch()} />;
  }
  const project = query.data;
  return (
    <>
      <header className="mb-3">
        <h1 className="text-display font-semibold">
          <span className="mono">{project.code}</span> · {project.name}
        </h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-small text-muted">
          {project.client_name && <span>{project.client_name}</span>}
          {project.current_stage ? (
            <span className="flex items-center gap-1.5">
              Stage {project.current_stage.seq} {project.current_stage.name} <StageChip state={project.current_stage.state} />
            </span>
          ) : (
            <span>No stages yet</span>
          )}
          {project.lead && <span>Lead {project.lead.short_name}</span>}
          {(project.cad_versions ?? []).length > 0 && <span>CAD: {(project.cad_versions ?? []).join(", ")}</span>}
        </p>
      </header>
      <nav aria-label="Project sections" className="mb-4 overflow-x-auto border-b border-border">
        <ul className="flex gap-1">
          {TABS.map((t) => (
            <li key={t.label}>
              <NavLink
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  cn(
                    "-mb-px block border-b-2 px-3 py-2 text-body whitespace-nowrap",
                    isActive ? "border-primary font-semibold text-primary" : "border-transparent text-muted hover:text-text",
                  )
                }
              >
                {t.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <Outlet context={{ project } satisfies ProjectContext} />
    </>
  );
}
