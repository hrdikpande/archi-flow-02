import { ChevronLeft, ChevronRight, Copy, Plus, TrendingDown, TrendingUp } from "lucide-react";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Dialog";
import { Field, Select, TextInput } from "@/components/ui/Field";
import { Card, PageHeader, tableClass, tdClass, thClass } from "@/components/ui/PageHeader";
import { DataState, EmptyState } from "@/components/ui/States";
import { SubNav } from "@/components/ui/SubNav";
import { useToast } from "@/components/ui/Toast";
import { ExportButton } from "@/features/exports/ExportButton";
import { useDisciplines, useMembers, useStages } from "@/features/projects/api";
import type { Me } from "@/lib/auth/useMe";
import { formatDate, todayISO } from "@/lib/format";

import {
  addDays,
  type Cell,
  isoWeek,
  mondayOf,
  useAllocations,
  useCopyForward,
  useSetAllocations,
  useWorkload,
  type WorkloadRow,
} from "./api";
import { WorkloadForecastCard } from "@/features/intelligence/WorkloadForecastCard";

const WEEKS_SHOWN = 8;

export function peopleTabs(me: Me) {
  return [
    { to: "/workload", label: "Heat map", end: true },
    { to: "/workload/staff", label: "Staff" },
    ...(me.capabilities.log_own_timesheet ? [{ to: "/timesheets", label: "My timesheet", end: true }] : []),
    ...(me.capabilities.allocate_hours ? [{ to: "/timesheets/approvals", label: "Approvals" }] : []),
  ];
}

/** Projects the viewer can allocate on: PL or DL there (03 §11 "Allocate hours"). */
function allocatableProjects(me: Me) {
  return me.memberships.filter((m) => m.role === "pl" || m.role === "dl");
}

/** S-09 Workload (F-17, F-19): people × weeks, % of capacity; cell opens the allocation drawer. */
export function WorkloadPage({ me }: { me: Me }) {
  const [from, setFrom] = useState(() => mondayOf(todayISO()));
  const [discipline, setDiscipline] = useState("");
  const to = addDays(from, 7 * (WEEKS_SHOWN - 1));
  const workload = useWorkload(from, to, discipline);
  const disciplines = useDisciplines();
  const [cell, setCell] = useState<{ row: WorkloadRow; cell: Cell } | null>(null);
  const [allocating, setAllocating] = useState(false);
  const canAllocate = me.capabilities.allocate_hours;
  const data = workload.data;
  const disciplineName = disciplines.data?.find((d) => d.id === discipline)?.name;

  return (
    <>
      <PageHeader
        title={`Workload${disciplineName ? ` · ${disciplineName}` : ""}`}
        meta={`Weeks ${isoWeek(from)}–${isoWeek(to)} · planned hours as % of capacity after leave and holidays. Over ${data?.over_pct ?? 110}% or under ${data?.under_pct ?? 50}% is flagged.`}
        actions={
          <>
            <ExportButton kind="workload" params={new URLSearchParams({ from, to, discipline })} />
            {canAllocate && (
              <Button variant="primary" icon={<Plus size={14} aria-hidden="true" />} onClick={() => setAllocating(true)}>
                Allocate
              </Button>
            )}
          </>
        }
      />
      <SubNav label="Workload sections" items={peopleTabs(me)} />
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <Field label="Discipline" className="w-56">
          {(p) => (
            <Select {...p} value={discipline} onChange={(e) => setDiscipline(e.target.value)}>
              <option value="">All disciplines</option>
              {disciplines.data?.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
          )}
        </Field>
        <div className="flex gap-1" role="group" aria-label="Weeks shown">
          <Button icon={<ChevronLeft size={14} aria-hidden="true" />} onClick={() => setFrom(addDays(from, -28))}>Earlier</Button>
          <Button onClick={() => setFrom(mondayOf(todayISO()))}>This week</Button>
          <Button icon={<ChevronRight size={14} aria-hidden="true" />} onClick={() => setFrom(addDays(from, 28))}>Later</Button>
        </div>
      </div>
      <Card>
        <DataState
          isPending={workload.isPending}
          error={workload.error}
          isEmpty={!data || data.people.length === 0}
          onRetry={() => workload.refetch()}
          empty={<EmptyState message="No one to show. You see your own load, your discipline as a DL, and your projects as a PL." />}
        >
          {data && <Heatmap data={data} onOpen={(row, c) => setCell({ row, cell: c })} />}
        </DataState>
      </Card>
      {me.capabilities.view_forecasts && <div className="mt-4"><WorkloadForecastCard /></div>}
      {cell && <CellDrawer me={me} row={cell.row} cell={cell.cell} onClose={() => setCell(null)} />}
      {allocating && <AllocateDrawer me={me} defaultWeek={from} onClose={() => setAllocating(false)} />}
    </>
  );
}

function Heatmap({ data, onOpen }: { data: NonNullable<ReturnType<typeof useWorkload>["data"]>; onOpen: (row: WorkloadRow, cell: Cell) => void }) {
  return (
    <div className="overflow-x-auto" role="region" aria-label="Workload heat map" tabIndex={0}>
      <table className={tableClass}>
        <thead>
          <tr>
            <th scope="col" className={`${thClass} sticky left-0 bg-surface`}>Person</th>
            {data.weeks.map((w) => (
              <th key={w} scope="col" className={`${thClass} text-right`}>
                W{isoWeek(w)} <span className="block text-small font-normal text-muted">{formatDate(w).slice(0, 6)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.people.map((row) => (
            <tr key={row.user.id}>
              <th scope="row" className={`${tdClass} sticky left-0 bg-surface font-normal`}>
                {row.user.short_name} {row.discipline && <span className="text-small text-muted">· {row.discipline}</span>}
              </th>
              {row.cells.map((c) => (
                <td key={c.week} className={`${tdClass} p-0.5 text-right`}>
                  <HeatCell row={row} cell={c} onOpen={() => onOpen(row, c)} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HeatCell({ row, cell, onOpen }: { row: WorkloadRow; cell: Cell; onOpen: () => void }) {
  const band = cell.band as "over" | "under" | null;
  const kind = band === "over" ? "over_allocated" : band === "under" ? "under_allocated" : null;
  const Icon = band === "over" ? TrendingUp : TrendingDown;
  const text = cell.pct === null ? "Leave" : `${cell.pct}%`;
  const label = `${row.user.short_name}, week ${isoWeek(cell.week)}: ${cell.pct === null ? "no capacity (leave or holiday)" : `${cell.pct}% of ${cell.capacity_h} h, ${cell.planned_h} h planned`}${band ? `, ${band}-allocated` : ""}. Open allocations.`;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={label}
      className="tabular inline-flex w-full items-center justify-end gap-1 rounded-sm px-2 py-1 hover:outline hover:outline-1 hover:outline-border"
      style={kind ? { color: `var(--flag-${kind}-fg)`, background: `var(--flag-${kind}-bg)` } : undefined}
    >
      {band && <Icon aria-hidden="true" size={14} />}
      {text}
    </button>
  );
}

/** Allocations for one person-week, with inline edit and "copy to next weeks". */
function CellDrawer({ me, row, cell, onClose }: { me: Me; row: WorkloadRow; cell: Cell; onClose: () => void }) {
  const allocations = useAllocations(row.user.id, cell.week);
  const setAlloc = useSetAllocations();
  const copy = useCopyForward();
  const toast = useToast();
  const [count, setCount] = useState("3");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const mine = new Set(allocatableProjects(me).map((m) => m.project_id));
  const items = allocations.data ?? [];

  const save = (a: (typeof items)[number]) => {
    const hours = edits[a.id];
    if (hours === undefined || hours === a.planned_h) return;
    setAlloc.mutate(
      { user: row.user.id, project: a.project, stage: a.stage, weeks: [cell.week], hours },
      {
        onSuccess: () => toast({ title: Number(hours) === 0 ? "Allocation removed" : `${a.project_code} · ${a.stage_name} set to ${hours} h` }),
        onError: (e) => toast({ title: "Not saved", description: e.message }),
      },
    );
  };

  return (
    <Drawer open onOpenChange={(o) => !o && onClose()} title={`${row.user.short_name} · week ${isoWeek(cell.week)}`}>
      <p className="mb-3 text-small text-muted">
        Week of {formatDate(cell.week)} · capacity {cell.capacity_h} h · planned {cell.planned_h} h{cell.pct !== null && ` (${cell.pct}%)`}
      </p>
      <DataState isPending={allocations.isPending} error={allocations.error} isEmpty={items.length === 0} onRetry={() => allocations.refetch()} empty={<EmptyState message="Nothing allocated this week." />}>
        <table className={tableClass}>
          <thead>
            <tr>
              <th scope="col" className={thClass}>Project</th>
              <th scope="col" className={thClass}>Stage</th>
              <th scope="col" className={`${thClass} text-right`}>Hours</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id}>
                <td className={tdClass}><span className="mono">{a.project_code}</span></td>
                <td className={tdClass}>{a.stage_name}</td>
                <td className={`${tdClass} text-right`}>
                  {mine.has(a.project) ? (
                    <TextInput
                      aria-label={`Hours on ${a.project_code} ${a.stage_name}`}
                      inputMode="decimal"
                      className="w-20 text-right tabular"
                      value={edits[a.id] ?? a.planned_h}
                      onChange={(e) => setEdits({ ...edits, [a.id]: e.target.value })}
                      onBlur={() => save(a)}
                      onKeyDown={(e) => e.key === "Enter" && save(a)}
                    />
                  ) : (
                    <span className="tabular">{a.planned_h}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataState>
      {me.capabilities.allocate_hours && items.length > 0 && (
        <form
          className="mt-4 flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            copy.mutate(
              { user: row.user.id, week: cell.week, count: Number(count) },
              {
                onSuccess: (r) => toast({ title: `Copied to the next ${count} weeks`, description: `${r.copied} allocations set.` }),
                onError: (err) => toast({ title: "Not copied", description: err.message }),
              },
            );
          }}
        >
          <Field label="Copy to next weeks" className="w-36">
            {(p) => <TextInput {...p} type="number" min={1} max={26} value={count} onChange={(e) => setCount(e.target.value)} />}
          </Field>
          <Button type="submit" busy={copy.isPending} icon={<Copy size={14} aria-hidden="true" />}>Copy</Button>
        </form>
      )}
    </Drawer>
  );
}

/** F-17: "allocate 20 h on Project X Stage 4 for weeks 44–47 in one action". */
function AllocateDrawer({ me, defaultWeek, onClose }: { me: Me; defaultWeek: string; onClose: () => void }) {
  const projects = allocatableProjects(me);
  const [project, setProject] = useState(projects[0]?.project_id ?? "");
  const stages = useStages(project);
  const members = useMembers(project);
  const [person, setPerson] = useState("");
  const [stage, setStage] = useState("");
  const [start, setStart] = useState(defaultWeek);
  const [weeks, setWeeks] = useState("4");
  const [hours, setHours] = useState("20");
  const setAlloc = useSetAllocations();
  const toast = useToast();
  const [error, setError] = useState<string>();
  const firstWeek = mondayOf(start || defaultWeek);
  const weekList = Array.from({ length: Math.max(1, Math.min(52, Number(weeks) || 1)) }, (_, i) => addDays(firstWeek, 7 * i));
  const people = [...new Map((members.data ?? []).map((m) => [m.user.id, m.user])).values()];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!person || !stage) {
      setError("Choose a person and a stage.");
      return;
    }
    setAlloc.mutate(
      { user: person, project, stage, weeks: weekList, hours },
      {
        onSuccess: () => {
          toast({ title: `${hours} h a week allocated for weeks ${isoWeek(weekList[0]!)}–${isoWeek(weekList.at(-1)!)}` });
          onClose();
        },
        onError: (err) => setError(err.message),
      },
    );
  };

  return (
    <Drawer open onOpenChange={(o) => !o && onClose()} title="Allocate hours">
      {projects.length === 0 ? (
        <EmptyState message="You allocate hours on projects where you are a PL or DL." />
      ) : (
        <form className="flex flex-col gap-3" onSubmit={submit}>
          <Field label="Project">
            {(p) => (
              <Select {...p} value={project} onChange={(e) => { setProject(e.target.value); setStage(""); setPerson(""); }}>
                {projects.map((m) => <option key={m.project_id} value={m.project_id}>{m.project_code}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Person" hint="People on this project's team.">
            {(p) => (
              <Select {...p} value={person} onChange={(e) => setPerson(e.target.value)}>
                <option value="">Choose…</option>
                {people.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Stage">
            {(p) => (
              <Select {...p} value={stage} onChange={(e) => setStage(e.target.value)}>
                <option value="">Choose…</option>
                {stages.data?.map((s) => <option key={s.id} value={s.id}>{s.seq}. {s.name}</option>)}
              </Select>
            )}
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="From week of">
              {(p) => <TextInput {...p} type="date" value={start} onChange={(e) => setStart(e.target.value)} />}
            </Field>
            <Field label="Weeks">
              {(p) => <TextInput {...p} type="number" min={1} max={52} value={weeks} onChange={(e) => setWeeks(e.target.value)} />}
            </Field>
            <Field label="Hours a week" hint="0 removes.">
              {(p) => <TextInput {...p} inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} />}
            </Field>
          </div>
          <p className="text-small text-muted">Weeks {isoWeek(weekList[0]!)}–{isoWeek(weekList.at(-1)!)} ({formatDate(weekList[0])} to {formatDate(addDays(weekList.at(-1)!, 6))}).</p>
          {error && <p role="alert" className="text-small text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" busy={setAlloc.isPending}>Allocate</Button>
          </div>
        </form>
      )}
    </Drawer>
  );
}
