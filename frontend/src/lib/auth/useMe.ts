import { useQuery } from "@tanstack/react-query";

import { api, ApiError, type Schemas, unwrap } from "@/lib/api/client";
import { setDisplayTimeZone } from "@/lib/format";

export type Me = Schemas["Me"];

/** The signed-in user, or null when signed out. */
export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async (): Promise<Me | null> => {
      try {
        const me = await unwrap(api.GET("/api/v1/me"));
        setDisplayTimeZone(me.organisation.timezone);
        return me;
      } catch (error) {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return null;
        throw error;
      }
    },
    refetchInterval: false,
    staleTime: 60_000,
  });
}
