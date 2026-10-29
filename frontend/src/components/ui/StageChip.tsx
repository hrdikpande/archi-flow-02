import { cn } from "@/lib/cn";

const TONE: Record<string, string> = {
  planned: "planned",
  active: "in_progress",
  deliverables_issued: "issued",
  client_approved: "approved_for_issue",
  ready_to_invoice: "approved_for_issue",
  invoiced: "issued",
  closed: "superseded",
  on_hold: "on_hold",
};
const LABEL: Record<string, string> = {
  planned: "Planned",
  active: "Active",
  deliverables_issued: "Deliverables issued",
  client_approved: "Client approved",
  ready_to_invoice: "Ready to invoice",
  invoiced: "Invoiced",
  closed: "Closed",
  on_hold: "On hold",
};

/** Stage state as text + tinted chip (stage states have no icons in DESIGN.md §2.2). */
export function StageChip({ state, className }: { state: string; className?: string }) {
  const tone = TONE[state] ?? "planned";
  return (
    <span
      className={cn("inline-flex items-center rounded-sm border px-1.5 py-0.5 text-small whitespace-nowrap", className)}
      style={{
        color: `var(--state-${tone}-fg)`,
        background: `var(--state-${tone}-bg)`,
        borderColor: `color-mix(in srgb, var(--state-${tone}-fg) 30%, transparent)`,
      }}
    >
      <span className="sr-only">Stage: </span>
      {LABEL[state] ?? state}
    </span>
  );
}
