import * as Popover from "@radix-ui/react-popover";
import { ChevronDown } from "lucide-react";

import { startTransition, useOptimistic } from "react";

import { cn } from "@/lib/cn";

export interface Option {
  value: string;
  label: string;
}

interface MultiSelectProps {
  label: string;
  options: Option[];
  value: string[];
  onChange: (value: string[]) => void;
}

/** Filter chip with a checkbox list (FilterBar, DESIGN.md §4). */
export function MultiSelect({ label, options, value, onChange }: MultiSelectProps) {
  // URL-backed filters update inside a router transition; show the new ticks straight away.
  const [shown, setShown] = useOptimistic(value);
  const selected = new Set(shown);
  const change = (next: string[]) =>
    startTransition(() => {
      setShown(next);
      onChange(next);
    });
  const summary =
    shown.length === 0 ? "All" : shown.length === 1 ? options.find((o) => o.value === shown[0])?.label ?? "1" : `${shown.length}`;
  return (
    <Popover.Root>
      <Popover.Trigger
        className={cn(
          "motion-hover inline-flex h-8 items-center gap-1 rounded-sm border px-2.5 text-small",
          shown.length ? "border-primary bg-surface text-primary" : "border-border bg-surface text-text hover:bg-surface-muted",
        )}
      >
        <span className="font-semibold">{label}:</span> {summary}
        <ChevronDown size={14} aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="z-50 max-h-80 min-w-52 overflow-y-auto rounded-md border border-border bg-surface p-1 shadow-overlay"
        >
          <fieldset>
            <legend className="sr-only">{label}</legend>
            {options.map((o) => (
              <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-body hover:bg-surface-muted">
                <input
                  type="checkbox"
                  checked={selected.has(o.value)}
                  onChange={(e) => {
                    const next = new Set(selected);
                    if (e.target.checked) next.add(o.value);
                    else next.delete(o.value);
                    change([...next]);
                  }}
                />
                {o.label}
              </label>
            ))}
          </fieldset>
          {shown.length > 0 && (
            <button type="button" className="mt-1 w-full rounded-sm px-2 py-1.5 text-left text-small text-primary hover:bg-surface-muted" onClick={() => change([])}>
              Clear
            </button>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
