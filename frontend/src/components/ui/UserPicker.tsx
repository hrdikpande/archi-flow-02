import * as Popover from "@radix-ui/react-popover";
import { useQuery } from "@tanstack/react-query";
import { useDeferredValue, useState } from "react";

import { api, unwrap } from "@/lib/api/client";

import { TextInput } from "./Field";

export interface PersonOption {
  id: string;
  full_name?: string;
  short_name?: string;
  email: string;
}

interface UserPickerProps {
  id?: string;
  value: PersonOption | null;
  onChange: (person: PersonOption | null) => void;
  /** Restrict to these people (e.g. project members); otherwise searches the firm directory. */
  options?: PersonOption[];
  placeholder?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

/** Search-as-you-type person picker. */
export function UserPicker({ id, value, onChange, options, placeholder = "Search by name or email", ...aria }: UserPickerProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const query = useDeferredValue(q.trim().toLowerCase());
  const directory = useQuery({
    queryKey: ["directory", query],
    queryFn: () => unwrap(api.GET("/api/v1/directory", { params: { query: { q: query || undefined } } })),
    enabled: open && !options,
  });
  const people = (options ?? directory.data ?? []).filter(
    (p) => !query || `${p.full_name} ${p.email}`.toLowerCase().includes(query),
  );
  const label = value ? value.full_name || value.email : "";

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Anchor asChild>
        <div className="relative">
          <TextInput
            id={id}
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
            {...aria}
            placeholder={value ? label : placeholder}
            value={open ? q : label}
            onFocus={() => {
              setQ("");
              setOpen(true);
            }}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
          />
        </div>
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="z-50 max-h-72 w-[var(--radix-popover-trigger-width)] min-w-64 overflow-y-auto rounded-md border border-border bg-surface p-1 shadow-overlay"
        >
          <ul role="listbox" aria-label="People">
            {value && (
              <li>
                <button type="button" role="option" aria-selected={false} className="w-full rounded-sm px-2 py-1.5 text-left text-small text-muted hover:bg-surface-muted" onClick={() => { onChange(null); setOpen(false); }}>
                  Clear selection
                </button>
              </li>
            )}
            {people.length === 0 && <li className="px-2 py-1.5 text-small text-muted">No one matches.</li>}
            {people.slice(0, 50).map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={value?.id === p.id}
                  className="flex w-full flex-col rounded-sm px-2 py-1.5 text-left hover:bg-surface-muted aria-selected:bg-surface-muted"
                  onClick={() => {
                    onChange(p);
                    setOpen(false);
                  }}
                >
                  <span className="text-body">{p.full_name || p.email}</span>
                  <span className="text-small text-muted">{p.email}</span>
                </button>
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
