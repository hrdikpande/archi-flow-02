import { QueryClient } from "@tanstack/react-query";

import { ApiError } from "./client";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Lists refetch on focus and every 60 s (DESIGN.md §6 "Live freshness").
      refetchOnWindowFocus: true,
      refetchInterval: 60_000,
      staleTime: 15_000,
      retry: (count, error) =>
        !(error instanceof ApiError && [400, 401, 403, 404].includes(error.status)) && count < 2,
    },
  },
});
