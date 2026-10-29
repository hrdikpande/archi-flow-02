import { cn } from "@/lib/cn";

import { SHEET_STATES, type SheetState } from "./status";

interface StatusChipProps {
  state: SheetState;
  /** Shown after "Issued" in mono, e.g. "C02". */
  revision?: string;
  className?: string;
}

/** Colour + icon + word, never colour alone (DESIGN.md §1.4, N-04). */
export function StatusChip({ state, revision, className }: StatusChipProps) {
  const { label, icon: Icon } = SHEET_STATES[state];
  const showRevision = state === "issued" && revision;
  return (
    <span
      className={cn(
        "inline-flex min-w-0 items-center gap-1 rounded-sm border px-1.5 py-0.5 text-small whitespace-nowrap",
        className,
      )}
      style={{
        color: `var(--state-${state}-fg)`,
        background: `var(--state-${state}-bg)`,
        borderColor: `color-mix(in srgb, var(--state-${state}-fg) 30%, transparent)`,
      }}
    >
      <Icon aria-hidden="true" size={14} strokeWidth={2} />
      <span className="sr-only">State: </span>
      <span className={cn(state === "superseded" && "line-through")}>{label}</span>
      {showRevision && (
        <>
          <span aria-hidden="true">·</span>
          <span className="mono">{revision}</span>
        </>
      )}
    </span>
  );
}
