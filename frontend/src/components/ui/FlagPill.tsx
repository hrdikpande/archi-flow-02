import * as Tooltip from "@radix-ui/react-tooltip";

import { cn } from "@/lib/cn";

import { FLAGS, type FlagKind } from "./status";

interface FlagPillProps {
  kind: FlagKind;
  /** Short text, e.g. "Due in 4 days", "Late 3 days", "132%". */
  text: string;
  /** Rule and date raised, shown on hover/focus. */
  detail?: string;
}

export function FlagPill({ kind, text, detail }: FlagPillProps) {
  const { label, icon: Icon } = FLAGS[kind];
  const pill = (
    <span
      tabIndex={detail ? 0 : undefined}
      className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-small whitespace-nowrap")}
      style={{ color: `var(--flag-${kind}-fg)`, background: `var(--flag-${kind}-bg)` }}
    >
      <Icon aria-hidden="true" size={14} strokeWidth={2} />
      <span className="sr-only">Flag: {label}. </span>
      {text}
    </span>
  );
  if (!detail) return pill;
  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{pill}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            sideOffset={4}
            className="z-50 max-w-xs rounded-md border border-border bg-surface px-3 py-2 text-small text-text shadow-overlay"
          >
            {detail}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
