import { useQuery } from "@tanstack/react-query";

import { api, unwrap } from "@/lib/api/client";

export function useIntelligenceStatus(enabled = true) {
  return useQuery({ queryKey: ["intelligence", "status"], queryFn: () => unwrap(api.GET("/api/v1/intelligence/status")), enabled, staleTime: 5 * 60_000 });
}

export function gateText(g: { months: number; cycles: number; needs_months: number; needs_cycles: number }) {
  return `Forecasts start once there are ${g.needs_months} months of history and ${g.needs_cycles.toLocaleString("en-IN")} issued sheets (now ${g.months} months, ${g.cycles.toLocaleString("en-IN")} issued).`;
}
