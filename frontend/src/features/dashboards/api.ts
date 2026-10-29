import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { api, type Schemas, unwrap } from "@/lib/api/client";

export type Portfolio = Schemas["Portfolio"];
export type ProjectDashboard = Schemas["ProjectDashboard"];
export type DisciplineDashboard = Schemas["DisciplineDashboard"];
export type MyWork = Schemas["MyWork"];
export type SheetBrief = Schemas["SheetBrief"];
export type Baseline = Schemas["Baseline"];
export type HoursReport = Schemas["HoursReport"];
export type ActivityItem = Schemas["ActivityItem"];
export type SearchResult = Schemas["SearchResult"];

// Dashboards read a model refreshed every 5 minutes (F-22); refetch on focus is enough.
const DASHBOARD = { staleTime: 60_000 };

export function usePortfolio() {
  return useQuery({ queryKey: ["dashboards", "portfolio"], queryFn: () => unwrap(api.GET("/api/v1/dashboards/portfolio")), ...DASHBOARD });
}

export function useProjectDashboard(id: string) {
  return useQuery({
    queryKey: ["dashboards", "project", id],
    queryFn: () => unwrap(api.GET("/api/v1/dashboards/projects/{id}", { params: { path: { id } } })),
    ...DASHBOARD,
  });
}

export function useDisciplineDashboard(code: string) {
  return useQuery({
    queryKey: ["dashboards", "discipline", code],
    queryFn: () => unwrap(api.GET("/api/v1/dashboards/disciplines/{code}", { params: { path: { code } } })),
    ...DASHBOARD,
  });
}

export function useMyWork() {
  return useQuery({ queryKey: ["dashboards", "me"], queryFn: () => unwrap(api.GET("/api/v1/dashboards/me")), staleTime: 15_000 });
}

export interface SheetFilter {
  flag?: string[];
  state?: string[];
  project?: string[];
  discipline?: string[];
  owner?: string;
}

export function useOrgSheets(filter: SheetFilter) {
  return useQuery({
    queryKey: ["sheets", filter],
    queryFn: () => unwrap(api.GET("/api/v1/sheets", { params: { query: filter as never } })),
  });
}

export function useBaseline(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: ["reports", "baseline", from, to],
    queryFn: () => unwrap(api.GET("/api/v1/reports/baseline", { params: { query: { from, to } } })),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useHoursReport(from: string, to: string, group: "project" | "stage" | "person" | "discipline", enabled = true) {
  return useQuery({
    queryKey: ["reports", "hours", from, to, group],
    queryFn: () => unwrap(api.GET("/api/v1/reports/hours", { params: { query: { from, to, group } } })),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useActivity(projectId: string, filter: { actor?: string; discipline?: string; type?: string[] }) {
  return useInfiniteQuery({
    queryKey: ["activity", projectId, filter],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      unwrap(
        api.GET("/api/v1/projects/{project_pk}/activity", {
          params: { path: { project_pk: projectId }, query: { ...filter, type: filter.type as never, cursor: pageParam } },
        }),
      ),
    getNextPageParam: (last) => (last.next ? new URL(last.next, window.location.origin).searchParams.get("cursor") ?? undefined : undefined),
  });
}

export function useSearch(q: string) {
  const term = q.trim();
  return useQuery({
    queryKey: ["search", term],
    queryFn: ({ signal }) => unwrap(api.GET("/api/v1/search", { params: { query: { q: term } }, signal })),
    enabled: term.length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

/** Register link with the same filters the dashboard number counted (F-22: every number links). */
export function registerLink(projectId: string, params: Record<string, string> = {}) {
  const q = new URLSearchParams(params).toString();
  return `/projects/${projectId}/register${q ? `?${q}` : ""}`;
}
