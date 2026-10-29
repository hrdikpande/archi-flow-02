import * as Popover from "@radix-ui/react-popover";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { Link } from "react-router";

import { Button } from "@/components/ui/Button";
import { Select, TextInput } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { api, type Schemas, unwrap } from "@/lib/api/client";
import { projectKeys, useMembers, usePackages } from "@/features/projects/api";
import { useProjectContext } from "@/features/projects/ProjectLayout";

import type { Sheet } from "./useSheets";

type Op = Schemas["OpEnum"];
const STATE_ACTIONS = [
  { value: "start", label: "Start" },
  { value: "submit", label: "Submit for check" },
  { value: "hold", label: "Hold" },
  { value: "resume_hold", label: "Resume" },
  { value: "cancel", label: "Cancel (reason needed)" },
];

/** F-46: one change to many sheets; reports "47 updated, 3 skipped" with reasons. */
export function BulkBar({ sheets, onDone }: { sheets: Sheet[]; onDone: () => void }) {
  const { project } = useProjectContext();
  const members = useMembers(project.id);
  const packages = usePackages(project.id);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [skipped, setSkipped] = useState<{ number: string; reason: string }[]>([]);
  const canEdit = !!project.my_permissions.edit_sheets;

  const bulk = useMutation({
    mutationFn: (body: { op: Op; value?: unknown; reason?: string }) =>
      unwrap(api.POST("/api/v1/projects/{project_pk}/sheets/bulk", { params: { path: { project_pk: project.id } }, body: { sheet_ids: sheets.map((s) => s.id), ...body } })),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.sheets(project.id) });
      setSkipped(result.skipped);
      toast({ title: `${result.updated.length} updated, ${result.skipped.length} skipped` });
      if (!result.skipped.length) onDone();
    },
    onError: (e) => toast({ title: "Not changed", description: e.message }),
  });
  const people = (members.data ?? []).map((m) => ({ value: m.user.id, label: m.user.full_name || m.user.email }));

  return (
    <div role="region" aria-label="Bulk actions" className="flex flex-col gap-2 rounded-md border border-primary bg-surface p-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="px-2 text-body font-semibold">{sheets.length} selected:</span>
        {canEdit && (
          <>
            <Choice label="Assign owner" options={people} onPick={(v) => bulk.mutate({ op: "assign_owner", value: v || null })} />
            <Choice label="Set checker" options={people} onPick={(v) => bulk.mutate({ op: "set_checker", value: v || null })} />
            <ShiftDates onShift={(n) => bulk.mutate({ op: "shift_dates", value: n })} />
            <Choice label="Move to package" options={(packages.data ?? []).map((p) => ({ value: p.id, label: p.name }))} onPick={(v) => bulk.mutate({ op: "move_package", value: v || null })} />
          </>
        )}
        {project.my_permissions.issue && sheets.every((s) => s.state === "approved_for_issue") && (
          <Link to={`/projects/${project.id}/issue?sheets=${sheets.map((s) => s.id).join(",")}`} className="inline-flex h-7 items-center rounded-sm bg-primary px-2 text-small font-semibold text-on-primary">
            Issue {sheets.length} sheet{sheets.length === 1 ? "" : "s"}…
          </Link>
        )}
        <Choice label="Change state" options={STATE_ACTIONS} withReason onPick={(v, reason) => bulk.mutate({ op: "transition", value: v, reason })} />
        <Button size="sm" variant="ghost" onClick={onDone}>Clear selection</Button>
      </div>
      {skipped.length > 0 && (
        <details open className="px-2 text-small">
          <summary className="cursor-pointer font-semibold">{skipped.length} skipped — why</summary>
          <ul className="mt-1 list-disc pl-5">
            {skipped.map((s) => <li key={s.number}><span className="mono">{s.number}</span>: {s.reason}</li>)}
          </ul>
        </details>
      )}
    </div>
  );
}

function Pop({ label, children }: { label: string; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button size="sm">{label}</Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={4} className="z-50 w-72 rounded-md border border-border bg-surface p-3 shadow-overlay">
          {children(() => setOpen(false))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function Choice({ label, options, onPick, withReason }: { label: string; options: { value: string; label: string }[]; onPick: (v: string, reason?: string) => void; withReason?: boolean }) {
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  return (
    <Pop label={label}>
      {(close) => (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onPick(value, reason);
            close();
          }}
        >
          <Select aria-label={label} value={value} onChange={(e) => setValue(e.target.value)}>
            <option value="">{withReason ? "Choose…" : "Nobody / none"}</option>
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
          {withReason && <TextInput aria-label="Reason" placeholder="Reason (for cancel)" value={reason} onChange={(e) => setReason(e.target.value)} />}
          <Button type="submit" size="sm" variant="primary" disabled={withReason && !value}>Apply</Button>
        </form>
      )}
    </Pop>
  );
}

function ShiftDates({ onShift }: { onShift: (n: number) => void }) {
  const [days, setDays] = useState("5");
  return (
    <Pop label="Shift dates ±">
      {(close) => (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onShift(Number(days));
            close();
          }}
        >
          <label htmlFor="shift-days" className="text-small font-semibold text-muted">Working days (negative moves earlier)</label>
          <TextInput id="shift-days" type="number" value={days} onChange={(e) => setDays(e.target.value)} />
          <Button type="submit" size="sm" variant="primary" disabled={!Number(days)}>Shift dates</Button>
        </form>
      )}
    </Pop>
  );
}
