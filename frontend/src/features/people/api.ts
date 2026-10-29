import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, type Schemas, unwrap } from "@/lib/api/client";

export type StaffRow = Schemas["Staff"];
export type Leave = Schemas["Leave"];
export type Allocation = Schemas["Allocation"];
export type Workload = Schemas["Workload"];
export type WorkloadRow = Schemas["WorkloadRow"];
export type Cell = Schemas["Cell"];
export type MyWeek = Schemas["MyWeek"];
export type Timesheet = Schemas["Timesheet"];
export type StageOption = Schemas["StageOption"];

export const peopleKeys = {
  staff: ["staff"] as const,
  leave: (user?: string) => ["leave", user ?? "all"] as const,
  workload: (from: string, to: string, discipline: string) => ["workload", from, to, discipline] as const,
  allocations: (user: string, week: string) => ["allocations", user, week] as const,
  myWeek: (week: string) => ["timesheets", "me", week] as const,
  approvals: (week: string) => ["timesheets", "approvals", week] as const,
};

export const LEAVE_LABELS: Record<Schemas["LeaveTypeEnum"], string> = {
  annual: "Annual leave",
  sick: "Sick leave",
  other: "Other",
};

/** YYYY-MM-DD of the Monday on or before `iso`. Date-only maths in UTC: no timezone shift. */
export function mondayOf(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** ISO week number, as the heat map columns are labelled "W44". */
export function isoWeek(iso: string): number {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}

export function useStaff() {
  return useQuery({ queryKey: peopleKeys.staff, queryFn: () => unwrap(api.GET("/api/v1/staff")) });
}

export function useLeave(user?: string) {
  return useQuery({
    queryKey: peopleKeys.leave(user),
    queryFn: () => unwrap(api.GET("/api/v1/leave", { params: { query: { user } } })),
  });
}

export function useWorkload(from: string, to: string, discipline: string) {
  return useQuery({
    queryKey: peopleKeys.workload(from, to, discipline),
    queryFn: () => unwrap(api.GET("/api/v1/workload", { params: { query: { from, to, discipline: discipline || undefined } } })),
  });
}

export function useAllocations(user: string, week: string, enabled = true) {
  return useQuery({
    queryKey: peopleKeys.allocations(user, week),
    queryFn: () => unwrap(api.GET("/api/v1/allocations", { params: { query: { user, week } } })),
    enabled,
  });
}

/** After any allocation or capacity change the heat map, drawer and flags must refresh. */
export function useInvalidatePeople() {
  const queryClient = useQueryClient();
  return () => {
    for (const key of ["workload", "allocations", "staff", "leave"]) queryClient.invalidateQueries({ queryKey: [key] });
  };
}

export function useSetAllocations() {
  const invalidate = useInvalidatePeople();
  return useMutation({
    mutationFn: (body: Schemas["AllocationSetRequest"]) => unwrap(api.PUT("/api/v1/allocations", { body })),
    onSuccess: invalidate,
  });
}

export function useCopyForward() {
  const invalidate = useInvalidatePeople();
  return useMutation({
    mutationFn: (body: Schemas["CopyForwardRequest"]) => unwrap(api.POST("/api/v1/allocations/copy-forward", { body })),
    onSuccess: invalidate,
  });
}

export function useMyWeek(week: string) {
  return useQuery({
    queryKey: peopleKeys.myWeek(week),
    queryFn: () => unwrap(api.GET("/api/v1/timesheets/me", { params: { query: { week } } })),
  });
}

export function useApprovals(week: string, enabled = true) {
  return useQuery({
    queryKey: peopleKeys.approvals(week),
    queryFn: () => unwrap(api.GET("/api/v1/timesheets/approvals", { params: { query: { week } } })),
    enabled,
  });
}
