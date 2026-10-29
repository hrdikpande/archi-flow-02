import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Lock, Send, Undo2 } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Field, Select, TextInput } from "@/components/ui/Field";
import { Card, PageHeader, tableClass, tdClass, thClass } from "@/components/ui/PageHeader";
import { DataState, EmptyState } from "@/components/ui/States";
import { SubNav } from "@/components/ui/SubNav";
import { useToast } from "@/components/ui/Toast";
import { ExportButton } from "@/features/exports/ExportButton";
import { api, unwrap } from "@/lib/api/client";
import type { Me } from "@/lib/auth/useMe";
import { formatDate, formatDateTime, todayISO } from "@/lib/format";

import { addDays, isoWeek, mondayOf, type MyWeek, type Timesheet, useApprovals, useMyWeek } from "./api";
import { peopleTabs } from "./WorkloadPage";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const STATE_LABEL: Record<Timesheet["state"], string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  returned: "Returned for correction",
};

const sum = (values: Array<string | number | undefined>) => values.reduce<number>((t, v) => t + (Number(v) || 0), 0);
const hoursText = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function WeekPicker({ week, onChange }: { week: string; onChange: (w: string) => void }) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Week">
      <Button aria-label="Previous week" icon={<ChevronLeft size={14} aria-hidden="true" />} onClick={() => onChange(addDays(week, -7))} />
      <span className="min-w-48 text-center text-body font-semibold tabular">
        W{isoWeek(week)} · {formatDate(week)} – {formatDate(addDays(week, 6))}
      </span>
      <Button aria-label="Next week" icon={<ChevronRight size={14} aria-hidden="true" />} onClick={() => onChange(addDays(week, 7))} />
    </div>
  );
}

/** S-10 Timesheet (F-18): rows = project · stage, columns Mon–Sun, totals; submit; approved weeks locked. */
export function TimesheetPage({ me }: { me: Me }) {
  // ?week= comes from the A-06 reminder link; the URL keeps the week the person is looking at.
  const [params, setParams] = useSearchParams();
  const week = mondayOf(params.get("week") || todayISO());
  const setWeek = (w: string) => setParams({ week: w }, { replace: true });
  const data = useMyWeek(week);

  return (
    <>
      <PageHeader title="Timesheet" meta="Log hours on the projects and stages you are on or allocated to. Submit last week's hours by Tuesday 12:00." />
      <SubNav label="Workload sections" items={peopleTabs(me)} />
      <div className="mb-3">
        <WeekPicker week={week} onChange={setWeek} />
      </div>
      <Card>
        <DataState isPending={data.isPending} error={data.error} isEmpty={false} empty={null} onRetry={() => data.refetch()}>
          {/* key resets the grid's local edits whenever the server copy changes */}
          {data.data && <WeekGrid key={`${data.data.timesheet.id}:${data.data.timesheet.state}:${data.data.timesheet.total_h}`} data={data.data} />}
        </DataState>
      </Card>
    </>
  );
}

type GridRow = { stage: string; label: string; planned?: string };

function WeekGrid({ data }: { data: MyWeek }) {
  const sheet = data.timesheet;
  const queryClient = useQueryClient();
  const toast = useToast();
  const days = Array.from({ length: 7 }, (_, i) => addDays(sheet.week, i));
  const working = new Set(data.working_days);
  const locked = sheet.state === "submitted" || sheet.state === "approved";
  const [cells, setCells] = useState<Record<string, string>>(() =>
    Object.fromEntries(sheet.entries.map((e) => [`${e.stage}|${e.date}`, e.hours])),
  );
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  const [added, setAdded] = useState<string[]>([]);

  const planned = new Map<string, number>();
  for (const a of data.allocations) planned.set(a.stage, (planned.get(a.stage) ?? 0) + Number(a.planned_h));
  const label = new Map(data.stages.map((s) => [s.stage, `${s.project_code} · ${s.stage_name}`]));
  // Rows: stages allocated this week or already logged, plus any the person adds. Entries on a
  // stage no longer offered (e.g. imported) still show.
  const shown = [...new Set([...planned.keys(), ...sheet.entries.map((e) => e.stage), ...added])];
  const rows: GridRow[] = shown.map((stage) => ({
    stage,
    label: label.get(stage) ?? "Other project",
    planned: planned.has(stage) ? hoursText(planned.get(stage)!) : undefined,
  }));
  const addable = data.stages.filter((s) => !shown.includes(s.stage));

  const value = (stage: string, day: string) => cells[`${stage}|${day}`] ?? "";
  const dayTotal = (day: string) => sum(rows.map((r) => value(r.stage, day)));
  const rowTotal = (stage: string) => sum(days.map((d) => value(stage, d)));
  const weekTotal = sum(days.map(dayTotal));

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["timesheets"] });
    queryClient.invalidateQueries({ queryKey: ["workload"] });
  };
  const body = () =>
    Object.entries(cells)
      .filter(([, h]) => Number(h) > 0)
      .map(([key, hours]) => {
        const [stage, date] = key.split("|") as [string, string];
        return { stage, date, hours, note: "" };
      });
  const save = useMutation({
    mutationFn: () => unwrap(api.PUT("/api/v1/timesheets/{id}/entries", { params: { path: { id: sheet.id } }, body: body() })),
    onSuccess: () => {
      refresh();
      toast({ title: "Hours saved" });
    },
    onError: (e) => setError(e.message),
  });
  const submit = useMutation({
    mutationFn: async () => {
      await unwrap(api.PUT("/api/v1/timesheets/{id}/entries", { params: { path: { id: sheet.id } }, body: body() }));
      return unwrap(api.POST("/api/v1/timesheets/{id}/submit", { params: { path: { id: sheet.id } } }));
    },
    onSuccess: () => {
      setConfirming(false);
      refresh();
      toast({ title: `Week ${isoWeek(sheet.week)} submitted`, description: `${hoursText(weekTotal)} h sent for approval.` });
    },
    onError: (e) => {
      setConfirming(false);
      setError(e.message);
    },
  });

  if (rows.length === 0 && addable.length === 0) {
    return <EmptyState message="You are not on any active project this week, so there is nothing to log hours against." />;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <p className="flex items-center gap-2 text-body">
          {sheet.state === "approved" && <Lock size={14} aria-hidden="true" />}
          <span className="font-semibold">{STATE_LABEL[sheet.state]}</span>
          {sheet.state === "approved" && sheet.approved_by && (
            <span className="text-small text-muted">by {sheet.approved_by.short_name} on {formatDateTime(sheet.approved_at)} · read-only</span>
          )}
          {sheet.state === "submitted" && <span className="text-small text-muted">on {formatDateTime(sheet.submitted_at)} · waiting for approval</span>}
          {sheet.imported && <span className="text-small text-muted">· imported</span>}
        </p>
        {!locked && (
          <div className="flex gap-2">
            <Button busy={save.isPending} onClick={() => { setError(undefined); save.mutate(); }}>Save</Button>
            <Button variant="primary" icon={<Send size={14} aria-hidden="true" />} onClick={() => setConfirming(true)}>Submit week</Button>
          </div>
        )}
      </div>
      {sheet.state === "returned" && (
        <p role="status" className="border-b border-border bg-surface-muted px-4 py-2 text-body">
          <Undo2 size={14} aria-hidden="true" className="mr-1 inline" /> Returned: {sheet.return_reason}
        </p>
      )}
      {error && <p role="alert" className="px-4 py-2 text-small text-danger">{error}</p>}
      <div className="overflow-x-auto" role="region" aria-label="Week grid" tabIndex={0}>
        <table className={tableClass}>
          <thead>
            <tr>
              <th scope="col" className={thClass}>Project · stage</th>
              {days.map((d, i) => (
                <th key={d} scope="col" className={`${thClass} text-right ${working.has(d) ? "" : "bg-surface-muted"}`}>
                  {DAY_NAMES[i]} <span className="block text-small font-normal text-muted">{formatDate(d).slice(0, 6)}</span>
                </th>
              ))}
              <th scope="col" className={`${thClass} text-right`}>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.stage}>
                <th scope="row" className={`${tdClass} font-normal`}>
                  {r.label}
                  {r.planned && <span className="block text-small text-muted">planned {r.planned} h</span>}
                </th>
                {days.map((d, i) => (
                  <td key={d} className={`${tdClass} p-1 text-right ${working.has(d) ? "" : "bg-surface-muted"}`}>
                    {locked ? (
                      <span className="tabular">{value(r.stage, d) || ""}</span>
                    ) : (
                      <TextInput
                        aria-label={`${r.label}, ${DAY_NAMES[i]} ${formatDate(d)}, hours`}
                        inputMode="decimal"
                        className="w-16 text-right tabular"
                        value={value(r.stage, d)}
                        onChange={(e) => setCells({ ...cells, [`${r.stage}|${d}`]: e.target.value })}
                      />
                    )}
                  </td>
                ))}
                <td className={`${tdClass} text-right font-semibold tabular`}>{hoursText(rowTotal(r.stage))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" className={`${tdClass} font-semibold`}>Day total</th>
              {days.map((d) => {
                const total = dayTotal(d);
                return (
                  <td key={d} className={`${tdClass} text-right tabular ${total > 24 ? "text-danger font-semibold" : ""}`}>
                    {hoursText(total)}
                    {total > 24 && <span className="sr-only"> (more than 24 hours)</span>}
                  </td>
                );
              })}
              <td className={`${tdClass} text-right font-semibold tabular`}>{hoursText(weekTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {!locked && addable.length > 0 && (
        <div className="border-t border-border px-4 py-3">
          <Field label="Add a row" className="w-96 max-w-full">
            {(p) => (
              <Select {...p} value="" onChange={(e) => e.target.value && setAdded([...added, e.target.value])}>
                <option value="">Choose project · stage…</option>
                {addable.map((s) => (
                  <option key={s.stage} value={s.stage}>{s.project_code} · {s.stage_name}</option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      )}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Submit week ${isoWeek(sheet.week)}?`}
        confirmLabel="Submit week"
        busy={submit.isPending}
        onConfirm={() => { setError(undefined); submit.mutate(); }}
      >
        {hoursText(weekTotal)} hours go to your lead for approval. You can't change them unless the week is returned.
      </ConfirmDialog>
    </div>
  );
}

/** DL/PL view of S-10: approve or return submitted weeks; who has not submitted. */
export function ApprovalsPage({ me }: { me: Me }) {
  const [params, setParams] = useSearchParams();
  const week = mondayOf(params.get("week") || addDays(todayISO(), -7));
  const setWeek = (w: string) => setParams({ week: w }, { replace: true });
  const approvals = useApprovals(week);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [returning, setReturning] = useState<Timesheet | null>(null);
  const [reason, setReason] = useState("");
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["timesheets"] });
  const approve = useMutation({
    mutationFn: (t: Timesheet) => unwrap(api.POST("/api/v1/timesheets/{id}/approve", { params: { path: { id: t.id } } })),
    onSuccess: (t) => {
      refresh();
      toast({ title: `${t.user.short_name}'s week ${isoWeek(t.week)} approved` });
    },
    onError: (e) => toast({ title: "Not approved", description: e.message }),
  });
  const send = useMutation({
    mutationFn: (t: Timesheet) => unwrap(api.POST("/api/v1/timesheets/{id}/return", { params: { path: { id: t.id } }, body: { reason } })),
    onSuccess: (t) => {
      refresh();
      setReturning(null);
      setReason("");
      toast({ title: `Returned to ${t.user.short_name}` });
    },
    onError: (e) => toast({ title: "Not returned", description: e.message }),
  });
  const items = approvals.data?.to_approve ?? [];
  const missing = approvals.data?.missing ?? [];

  return (
    <>
      <PageHeader
        title="Timesheet approvals"
        meta="Submitted weeks for people on your projects and disciplines. Approved weeks are locked."
        actions={<ExportButton kind="timesheets" params={new URLSearchParams({ from: week, to: addDays(week, 6) })} />}
      />
      <SubNav label="Workload sections" items={peopleTabs(me)} />
      <div className="flex flex-col gap-4">
        <Card title="Waiting for approval">
          <DataState isPending={approvals.isPending} error={approvals.error} isEmpty={items.length === 0} onRetry={() => approvals.refetch()} empty={<EmptyState message="No submitted weeks are waiting for you." />}>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th scope="col" className={thClass}>Person</th>
                  <th scope="col" className={thClass}>Week</th>
                  <th scope="col" className={`${thClass} text-right`}>Hours</th>
                  <th scope="col" className={thClass}>Submitted</th>
                  <th scope="col" className={thClass}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {items.map((t) => (
                  <tr key={t.id}>
                    <td className={tdClass}>{t.user.full_name}</td>
                    <td className={`${tdClass} tabular`}>W{isoWeek(t.week)} · {formatDate(t.week)}</td>
                    <td className={`${tdClass} text-right tabular`}>{t.total_h}</td>
                    <td className={tdClass}>{formatDateTime(t.submitted_at)}{t.imported && " · imported"}</td>
                    <td className={`${tdClass} text-right`}>
                      {t.can_approve && (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" onClick={() => setReturning(t)}>Return</Button>
                          <Button size="sm" variant="primary" busy={approve.isPending && approve.variables?.id === t.id} onClick={() => approve.mutate(t)}>Approve</Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataState>
        </Card>
        <Card title="Missing timesheets" actions={<WeekPicker week={week} onChange={setWeek} />}>
          {approvals.isPending ? null : missing.length === 0 ? (
            <EmptyState message="Everyone you lead has submitted this week." />
          ) : (
            <ul className="flex flex-col gap-1 px-4 py-3">
              {missing.map((u) => <li key={u.id} className="text-body">{u.full_name} <span className="text-small text-muted">{u.email}</span></li>)}
            </ul>
          )}
        </Card>
      </div>
      <ConfirmDialog
        open={!!returning}
        onOpenChange={(o) => !o && setReturning(null)}
        title={`Return ${returning?.user.short_name}'s week?`}
        confirmLabel="Return week"
        busy={send.isPending}
        onConfirm={() => returning && reason.trim() && send.mutate(returning)}
      >
        <Field label="What should be corrected?">
          {(p) => <TextInput {...p} value={reason} onChange={(e) => setReason(e.target.value)} />}
        </Field>
      </ConfirmDialog>
    </>
  );
}
