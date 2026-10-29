import {
  AlarmClockOff,
  Archive,
  BadgeCheck,
  CircleDashed,
  CircleX,
  ClockAlert,
  type LucideIcon,
  Pause,
  Pencil,
  ReceiptIndianRupee,
  SearchCheck,
  Send,
  SendHorizontal,
  TimerOff,
  TrendingDown,
  TrendingUp,
  Undo2,
} from "lucide-react";

/** Sheet workflow states (docs/03 §3) with their DESIGN.md §2.2 label and icon. */
export const SHEET_STATES = {
  planned: { label: "Planned", icon: CircleDashed },
  in_progress: { label: "In progress", icon: Pencil },
  ready_for_check: { label: "Ready for check", icon: Send },
  in_check: { label: "In check", icon: SearchCheck },
  changes_requested: { label: "Changes requested", icon: Undo2 },
  approved_for_issue: { label: "Approved for issue", icon: BadgeCheck },
  issued: { label: "Issued", icon: SendHorizontal },
  superseded: { label: "Superseded", icon: Archive },
  on_hold: { label: "On hold", icon: Pause },
  cancelled: { label: "Cancelled", icon: CircleX },
} as const satisfies Record<string, { label: string; icon: LucideIcon }>;

export type SheetState = keyof typeof SHEET_STATES;

/** Flags (DESIGN.md §2.3): computed warnings shown beside the state chip. */
export const FLAGS = {
  at_risk: { label: "At risk", icon: ClockAlert },
  late: { label: "Late", icon: AlarmClockOff },
  over_allocated: { label: "Over-allocated", icon: TrendingUp },
  under_allocated: { label: "Under-allocated", icon: TrendingDown },
  timesheet_missing: { label: "Hours missing", icon: TimerOff },
  ready_to_invoice: { label: "Ready to invoice", icon: ReceiptIndianRupee },
} as const satisfies Record<string, { label: string; icon: LucideIcon }>;

export type FlagKind = keyof typeof FLAGS;
