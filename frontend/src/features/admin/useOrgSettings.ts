import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, type Schemas, unwrap } from "@/lib/api/client";

type Settings = Schemas["OrgSettings"];
type Patch = Schemas["PatchedOrgSettingsRequest"];

export function useOrgSettings() {
  return useQuery({ queryKey: ["org-settings"], queryFn: () => unwrap(api.GET("/api/v1/org/settings")) });
}

/** Settings edits are non-destructive, so the UI updates optimistically and rolls back on error
 * (DESIGN.md §6). */
export function useSaveOrgSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Patch) => unwrap(api.PATCH("/api/v1/org/settings", { body })),
    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey: ["org-settings"] });
      const previous = queryClient.getQueryData<Settings>(["org-settings"]);
      if (previous) {
        const { organisation, ...rest } = body;
        queryClient.setQueryData<Settings>(["org-settings"], {
          ...previous,
          ...(rest as Partial<Settings>),
          organisation: { ...previous.organisation!, ...organisation } as Settings["organisation"],
        });
      }
      return { previous };
    },
    onError: (_error, _body, context) => {
      if (context?.previous) queryClient.setQueryData(["org-settings"], context.previous);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["org-settings"], data);
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}
