import { useQuery } from "@tanstack/react-query";

import { api, type Schemas, unwrap } from "@/lib/api/client";

export type Project = Schemas["Project"];
export type Stage = Schemas["Stage"];
export type Member = Schemas["Membership"];
export type Package = Schemas["Package"];
export type Discipline = Schemas["Discipline"];

export const projectKeys = {
  all: ["projects"] as const,
  detail: (id: string) => ["projects", id] as const,
  stages: (id: string) => ["projects", id, "stages"] as const,
  members: (id: string) => ["projects", id, "members"] as const,
  packages: (id: string) => ["projects", id, "packages"] as const,
  sheets: (id: string) => ["projects", id, "sheets"] as const,
};

export function useProject(id: string) {
  return useQuery({ queryKey: projectKeys.detail(id), queryFn: () => unwrap(api.GET("/api/v1/projects/{id}", { params: { path: { id } } })) });
}

export function useStages(id: string) {
  return useQuery({
    queryKey: projectKeys.stages(id),
    queryFn: () => unwrap(api.GET("/api/v1/projects/{project_pk}/stages", { params: { path: { project_pk: id } } })),
  });
}

export function useMembers(id: string) {
  return useQuery({
    queryKey: projectKeys.members(id),
    queryFn: () => unwrap(api.GET("/api/v1/projects/{project_pk}/members", { params: { path: { project_pk: id } } })),
  });
}

export function usePackages(id: string) {
  return useQuery({
    queryKey: projectKeys.packages(id),
    queryFn: () => unwrap(api.GET("/api/v1/projects/{project_pk}/packages", { params: { path: { project_pk: id } } })),
  });
}

export function useDisciplines() {
  return useQuery({ queryKey: ["disciplines"], queryFn: () => unwrap(api.GET("/api/v1/disciplines")), staleTime: 5 * 60_000 });
}

export const ROLE_LABELS: Record<string, string> = {
  pl: "Project lead",
  dl: "Discipline lead",
  designer: "Designer",
  senior_reviewer: "Senior reviewer",
  dc: "Document controller",
  viewer: "Viewer",
};

export const STAGE_STATE_LABELS: Record<string, string> = {
  planned: "Planned",
  active: "Active",
  deliverables_issued: "Deliverables issued",
  client_approved: "Client approved",
  ready_to_invoice: "Ready to invoice",
  invoiced: "Invoiced",
  closed: "Closed",
  on_hold: "On hold",
};

export const PROJECT_TYPES = [
  { value: "hospital", label: "Hospital" },
  { value: "residential", label: "Residential" },
  { value: "commercial", label: "Commercial" },
  { value: "other", label: "Other" },
] as const;
