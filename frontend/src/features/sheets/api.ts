import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, type Schemas, unwrap } from "@/lib/api/client";
import { projectKeys } from "@/features/projects/api";

export type SheetDetail = Schemas["SheetDetail"];
export type Revision = Schemas["Revision"];
export type AllowedAction = Schemas["AllowedAction"];

export const sheetKeys = {
  detail: (id: string) => ["sheet", id] as const,
  revisions: (id: string) => ["sheet", id, "revisions"] as const,
  reviews: (id: string) => ["sheet", id, "reviews"] as const,
  timeline: (id: string) => ["sheet", id, "timeline"] as const,
};

export function useSheetDetail(id: string) {
  return useQuery({ queryKey: sheetKeys.detail(id), queryFn: () => unwrap(api.GET("/api/v1/sheets/{id}/detail", { params: { path: { id } } })) });
}

export function useRevisions(id: string) {
  return useQuery({
    queryKey: sheetKeys.revisions(id),
    queryFn: () => unwrap(api.GET("/api/v1/sheets/{id}/revisions", { params: { path: { id } } })),
    // A fresh upload's naming check finishes on the worker: poll while any draft is "checking".
    refetchInterval: (q) => (q.state.data?.some((r) => r.naming_status === "pending" && r.has_file) ? 1500 : 60_000),
  });
}

export function useSheetReviews(id: string) {
  return useQuery({ queryKey: sheetKeys.reviews(id), queryFn: () => unwrap(api.GET("/api/v1/sheets/{id}/reviews", { params: { path: { id } } })) });
}

export function useTimeline(id: string) {
  return useQuery({ queryKey: sheetKeys.timeline(id), queryFn: () => unwrap(api.GET("/api/v1/sheets/{id}/timeline", { params: { path: { id } } })) });
}

/** F-13: items to tick before submit, or the ticks given for the round under review. */
export function usePrecheck(sheetId: string, enabled = true) {
  return useQuery({
    queryKey: ["sheets", sheetId, "precheck"],
    queryFn: () => unwrap(api.GET("/api/v1/sheets/{id}/precheck", { params: { path: { id: sheetId } } })),
    enabled,
  });
}

export function useTransition(sheetId: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Schemas["TransitionRequestRequest"]) =>
      unwrap(api.POST("/api/v1/sheets/{id}/transitions", { params: { path: { id: sheetId } }, body })),
    onSuccess: (sheet) => {
      queryClient.setQueryData(sheetKeys.detail(sheetId), sheet);
      for (const key of [sheetKeys.revisions(sheetId), sheetKeys.reviews(sheetId), sheetKeys.timeline(sheetId), projectKeys.sheets(projectId), ["reviews"], ["sheets", sheetId, "precheck"]]) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}

export async function openRevision(revisionId: string) {
  return unwrap(api.GET("/api/v1/revisions/{id}/download", { params: { path: { id: revisionId } } }));
}

/** Signed link to a revision PDF (valid 5 minutes; refreshed before expiry). */
export function useRevisionLink(revisionId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ["revision-link", revisionId],
    queryFn: () => openRevision(revisionId!),
    enabled: !!revisionId && enabled,
    staleTime: 4 * 60_000,
    refetchInterval: false,
  });
}
