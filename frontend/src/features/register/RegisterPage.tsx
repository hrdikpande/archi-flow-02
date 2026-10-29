import * as Popover from "@radix-ui/react-popover";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, Columns3, FileSpreadsheet, Plus, Save, Search, Upload } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Dialog";
import { Select, TextInput } from "@/components/ui/Field";
import { FlagPill } from "@/components/ui/FlagPill";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { DataState, EmptyState } from "@/components/ui/States";
import { SHEET_STATES, type SheetState } from "@/components/ui/status";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { api, type Schemas, unwrap } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { projectKeys, useDisciplines, useMembers, usePackages, useStages } from "@/features/projects/api";
import { useProjectContext } from "@/features/projects/ProjectLayout";

import { ExportButton } from "@/features/exports/ExportButton";

import { BulkBar } from "./BulkBar";
import { SheetForm } from "./SheetForm";
import { UploadPdfs } from "./UploadPdfs";
import { useOpenProposals } from "./CadSyncPage";
import { flagFor, type Sheet, useSheets } from "./useSheets";

type Editable = "owner" | "checker" | "planned_issue_date" | "package";
const FILTER_KEYS = ["discipline", "stage", "state", "owner", "package"] as const;
const GROUPS = [
  { value: "", label: "No grouping" },
  { value: "discipline", label: "Discipline" },
  { value: "package", label: "Package" },
  { value: "stage", label: "Stage" },
];
const COLUMN_LABELS: Record<string, string> = {
  title: "Title",
  discipline: "Disc",
  stage: "Stage",
  package: "Package",
  owner: "Owner",
  checker: "Checker",
  state: "State",
  planned: "Planned",
  rev: "Rev",
  flags: "Flags",
};

/** S-05 Register (F-04, F-46, F-52 export arrives with S6). */
export function RegisterPage() {
  const { project } = useProjectContext();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const sheets = useSheets(project.id);
  const disciplines = useDisciplines();
  const stages = useStages(project.id);
  const members = useMembers(project.id);
  const packages = usePackages(project.id);
  const canEdit = !!project.my_permissions.edit_sheets;
  const proposals = useOpenProposals(project.id, canEdit);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [anchor, setAnchor] = useState<number | null>(null);
  const [active, setActive] = useState(0);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [visibility, setVisibility] = useState<VisibilityState>({ stage: false, package: false });

  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.getAll(k)])) as Record<(typeof FILTER_KEYS)[number], string[]>;
  const q = params.get("q") ?? "";
  const groupBy = params.get("group") ?? "";
  const lateOnly = params.get("late") === "1";
  const riskOnly = params.get("risk") === "1";

  const setParam = (key: string, values: string[] | string) => {
    const next = new URLSearchParams(params);
    next.delete(key);
    for (const v of Array.isArray(values) ? values : [values]) if (v) next.append(key, v);
    setParams(next, { replace: true });
  };

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (sheets.data ?? []).filter((s) => {
      if (filters.discipline.length && !filters.discipline.includes(s.discipline)) return false;
      if (filters.stage.length && !filters.stage.includes(s.stage)) return false;
      if (filters.state.length && !filters.state.includes(s.state)) return false;
      if (filters.owner.length && !filters.owner.includes(s.owner ?? "")) return false;
      if (filters.package.length && !filters.package.includes(s.package ?? "")) return false;
      if (lateOnly && !s.flags?.some((f) => f.kind === "late")) return false;
      if (riskOnly && !s.flags?.some((f) => f.kind === "at_risk")) return false;
      if (term && !`${s.number} ${s.title} ${s.aliases.join(" ")}`.toLowerCase().includes(term)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheets.data, params]);

  const columns = useMemo<ColumnDef<Sheet>[]>(
    () => [
      { id: "number", header: "Sheet", accessorKey: "number", cell: (c) => <span className="mono font-semibold">{c.row.original.number}</span> },
      { id: "title", header: "Title", accessorKey: "title" },
      { id: "discipline", header: "Disc", accessorKey: "discipline_code" },
      { id: "stage", header: "Stage", accessorKey: "stage_name" },
      { id: "package", header: "Package", accessorFn: (s) => s.package_name ?? "" },
      { id: "owner", header: "Owner", accessorFn: (s) => s.owner_detail?.short_name ?? "" },
      { id: "checker", header: "Checker", accessorFn: (s) => s.checker_detail?.short_name ?? "" },
      { id: "state", header: "State", accessorKey: "state", cell: (c) => <StatusChip state={c.row.original.state as SheetState} revision={c.row.original.current_revision_code ?? undefined} /> },
      { id: "planned", header: "Planned", accessorFn: (s) => s.effective_planned_date ?? "" },
      { id: "rev", header: "Rev", accessorFn: (s) => s.current_revision_code ?? "", cell: (c) => <span className="mono">{c.getValue<string>()}</span> },
      { id: "flags", header: "Flags", enableSorting: false, cell: (c) => <Flags sheet={c.row.original} /> },
    ],
    [],
  );

  // TanStack Table returns new functions each render, so the React Compiler skips this
  // component (documented incompatibility); memoisation is handled by useMemo above.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, columnVisibility: visibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const sortedRows = table.getRowModel().rows;

  // Group headers are flattened into the virtual list.
  type Item = { kind: "group"; label: string; count: number } | { kind: "row"; index: number };
  const items = useMemo<Item[]>(() => {
    if (!groupBy) return sortedRows.map((_, index) => ({ kind: "row", index }));
    const keyOf = (s: Sheet) =>
      groupBy === "discipline" ? s.discipline_code : groupBy === "stage" ? s.stage_name : s.package_name ?? "No package";
    const groups = new Map<string, number[]>();
    sortedRows.forEach((r, index) => {
      const key = keyOf(r.original);
      groups.set(key, [...(groups.get(key) ?? []), index]);
    });
    return [...groups.entries()].flatMap(([label, indexes]) => [
      { kind: "group" as const, label, count: indexes.length },
      ...indexes.map((index) => ({ kind: "row" as const, index })),
    ]);
  }, [groupBy, sortedRows]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({ count: items.length, getScrollElement: () => scrollRef.current, estimateSize: () => 37, overscan: 15 });
  const virtualItems = virtualizer.getVirtualItems();
  const padTop = virtualItems[0]?.start ?? 0;
  const padBottom = virtualizer.getTotalSize() - (virtualItems.at(-1)?.end ?? 0);
  const visibleCols = table.getVisibleLeafColumns().length + 1;

  useEffect(() => setSelected(new Set()), [params]);

  const toggle = (rowIndex: number, shift: boolean) => {
    const id = sortedRows[rowIndex]!.original.id;
    setSelected((current) => {
      const next = new Set(current);
      if (shift && anchor !== null) {
        const [a, b] = [Math.min(anchor, rowIndex), Math.max(anchor, rowIndex)];
        for (let i = a; i <= b; i++) next.add(sortedRows[i]!.original.id);
      } else if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setAnchor(rowIndex);
  };

  const rowItemIndexes = items.flatMap((it, i) => (it.kind === "row" ? [i] : []));
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("input,select,textarea,button")) return;
    const pos = Math.max(0, rowItemIndexes.indexOf(active));
    if (e.key === "j" || e.key === "ArrowDown") {
      const next = rowItemIndexes[Math.min(pos + 1, rowItemIndexes.length - 1)] ?? 0;
      setActive(next);
      virtualizer.scrollToIndex(next);
      e.preventDefault();
    } else if (e.key === "k" || e.key === "ArrowUp") {
      const next = rowItemIndexes[Math.max(pos - 1, 0)] ?? 0;
      setActive(next);
      virtualizer.scrollToIndex(next);
      e.preventDefault();
    } else if (e.key === "Enter" || e.key === "x" || e.key === " ") {
      const item = items[active];
      if (item?.kind !== "row") return;
      if (e.key === "Enter") navigate(`/projects/${project.id}/sheets/${sortedRows[item.index]!.original.id}`);
      else toggle(item.index, e.shiftKey);
      e.preventDefault();
    }
  };

  const options = {
    discipline: (disciplines.data ?? []).map((d) => ({ value: d.id, label: `${d.code} ${d.name}` })),
    stage: (stages.data ?? []).map((s) => ({ value: s.id, label: `${s.seq} ${s.name}` })),
    state: Object.entries(SHEET_STATES).map(([value, s]) => ({ value, label: s.label })),
    owner: (members.data ?? []).map((m) => ({ value: m.user.id, label: m.user.full_name || m.user.email })),
    package: (packages.data ?? []).map((p) => ({ value: p.id, label: p.name })),
  };
  const selectedSheets = (sheets.data ?? []).filter((s) => selected.has(s.id));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-title font-semibold">Register</h2>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Link to={`/projects/${project.id}/import`} className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-border bg-surface px-3 font-semibold hover:bg-surface-muted">
              <FileSpreadsheet size={16} aria-hidden="true" /> Import Excel
            </Link>
          )}
          {project.my_permissions.upload_draft && (
            <Button icon={<Upload size={16} aria-hidden="true" />} onClick={() => setUploading(true)}>Upload PDFs</Button>
          )}
          {(proposals.data?.length ?? 0) > 0 && (
            <Link to="../cad-sync" className="inline-flex h-9 items-center rounded-sm border border-primary px-3 text-body text-primary hover:bg-surface-muted">
              CAD sync: {proposals.data!.length} to review
            </Link>
          )}
          <ExportButton kind="register" projectId={project.id} params={params} />
          {canEdit && <Button variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => setCreating(true)}>Sheet</Button>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filters">
        <div className="relative w-56">
          <Search size={14} aria-hidden="true" className="pointer-events-none absolute top-2 left-2 text-muted" />
          <TextInput aria-label="Search sheets" placeholder="Number or title" className="h-8 pl-7 text-small" value={q} onChange={(e) => setParam("q", e.target.value)} />
        </div>
        <MultiSelect label="Discipline" options={options.discipline} value={filters.discipline} onChange={(v) => setParam("discipline", v)} />
        <MultiSelect label="Stage" options={options.stage} value={filters.stage} onChange={(v) => setParam("stage", v)} />
        <MultiSelect label="State" options={options.state} value={filters.state} onChange={(v) => setParam("state", v)} />
        <MultiSelect label="Owner" options={options.owner} value={filters.owner} onChange={(v) => setParam("owner", v)} />
        <MultiSelect label="Package" options={options.package} value={filters.package} onChange={(v) => setParam("package", v)} />
        <label className="flex items-center gap-1.5 text-small">
          <input type="checkbox" checked={lateOnly} onChange={(e) => setParam("late", e.target.checked ? "1" : "")} /> Late only
        </label>
        <label className="flex items-center gap-1.5 text-small">
          <input type="checkbox" checked={riskOnly} onChange={(e) => setParam("risk", e.target.checked ? "1" : "")} /> At risk only
        </label>
        <Select aria-label="Group by" className="h-8 w-40 text-small" value={groupBy} onChange={(e) => setParam("group", e.target.value)}>
          {GROUPS.map((g) => <option key={g.value} value={g.value}>{g.value ? `Group: ${g.label}` : g.label}</option>)}
        </Select>
        <ColumnChooser visibility={visibility} onChange={setVisibility} />
        <SavedViews projectId={project.id} visibility={visibility} onApply={(config) => {
          setParams(new URLSearchParams(config.params ?? ""), { replace: true });
          if (config.columns) setVisibility(config.columns);
        }} />
      </div>

      {selected.size > 0 && (
        <BulkBar sheets={selectedSheets} onDone={() => setSelected(new Set())} />
      )}

      <div className="rounded-md border border-border bg-surface">
        <DataState
          isPending={sheets.isPending}
          error={sheets.error}
          isEmpty={(sheets.data ?? []).length === 0}
          onRetry={() => sheets.refetch()}
          empty={
            <EmptyState
              message="No sheets yet. Import your Excel register."
              action={canEdit && <Link to={`/projects/${project.id}/import`} className="text-primary underline">Import Excel register</Link>}
            />
          }
        >
          {rows.length === 0 ? (
            <EmptyState message="No sheets match these filters." action={<Button size="sm" onClick={() => setParams(new URLSearchParams(), { replace: true })}>Clear filters</Button>} />
          ) : (
            <div
              ref={scrollRef}
              tabIndex={0}
              role="region"
              aria-label={`Register, ${rows.length} sheets. Use j and k to move, x to select, Enter to open.`}
              onKeyDown={onKeyDown}
              className="max-h-[calc(100vh-300px)] min-h-64 overflow-auto"
            >
              <table className="w-full border-collapse text-left text-body" aria-rowcount={rows.length + 1}>
                <thead className="sticky top-0 z-20 bg-surface-muted">
                  <tr aria-rowindex={1}>
                    <th scope="col" className="sticky left-0 z-30 w-9 border-b border-border bg-surface-muted px-2">
                      <input
                        type="checkbox"
                        aria-label="Select all shown sheets"
                        checked={selected.size > 0 && selected.size === rows.length}
                        onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())}
                      />
                    </th>
                    {table.getHeaderGroups()[0]!.headers.map((h) => {
                      const sorted = h.column.getIsSorted();
                      return (
                        <th
                          key={h.id}
                          scope="col"
                          aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                          className={cn(
                            "border-b border-border px-3 py-2 text-small font-semibold whitespace-nowrap text-muted",
                            h.id === "number" && "sticky left-9 z-30 bg-surface-muted",
                          )}
                        >
                          {h.column.getCanSort() ? (
                            <button type="button" className="inline-flex items-center gap-1" onClick={h.column.getToggleSortingHandler()}>
                              {flexRender(h.column.columnDef.header, h.getContext())}
                              {sorted === "asc" ? <ArrowUp size={12} aria-hidden="true" /> : sorted === "desc" ? <ArrowDown size={12} aria-hidden="true" /> : null}
                            </button>
                          ) : (
                            flexRender(h.column.columnDef.header, h.getContext())
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {padTop > 0 && (
                    <tr aria-hidden="true">
                      <td colSpan={visibleCols} style={{ height: padTop, padding: 0 }} />
                    </tr>
                  )}
                  {virtualItems.map((v) => {
                    const item = items[v.index]!;
                    if (item.kind === "group") {
                      return (
                        <tr key={`g-${item.label}`} data-index={v.index}>
                          <th scope="rowgroup" colSpan={visibleCols} className="sticky left-0 border-b border-border bg-bg px-3 py-1.5 text-left text-small font-semibold">
                            {item.label} <span className="text-muted">· {item.count}</span>
                          </th>
                        </tr>
                      );
                    }
                    const row = sortedRows[item.index]!;
                    const sheet = row.original;
                    const isSelected = selected.has(sheet.id);
                    return (
                      <tr
                        key={sheet.id}
                        aria-rowindex={item.index + 2}
                        aria-selected={isSelected}
                        className={cn(
                          "h-9 cursor-pointer border-b border-border hover:bg-surface-muted",
                          isSelected && "bg-surface-muted",
                          v.index === active && "outline-2 -outline-offset-2 outline-focus",
                        )}
                        onClick={(e) => {
                          setActive(v.index);
                          if ((e.target as HTMLElement).closest("input,select,button,a,[data-edit]")) return;
                          if (e.shiftKey) toggle(item.index, true);
                          else navigate(`/projects/${project.id}/sheets/${sheet.id}`);
                        }}
                      >
                        <td className={cn("sticky left-0 z-10 w-9 px-2", isSelected ? "bg-surface-muted" : "bg-surface")}>
                          <input
                            type="checkbox"
                            aria-label={`Select ${sheet.number}`}
                            checked={isSelected}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggle(item.index, e.shiftKey);
                            }}
                            onChange={() => {}}
                          />
                        </td>
                        {row.getVisibleCells().map((cell) => (
                          <td
                            key={cell.id}
                            className={cn(
                              "px-3 py-1.5 whitespace-nowrap",
                              cell.column.id === "number" && cn("sticky left-9 z-10", isSelected ? "bg-surface-muted" : "bg-surface"),
                              cell.column.id === "title" && "max-w-80 truncate",
                            )}
                          >
                            <EditableCell column={cell.column.id} sheet={sheet} canEdit={canEdit}>
                              {flexRender(cell.column.columnDef.cell ?? ((c) => String(c.getValue() ?? "")), cell.getContext())}
                            </EditableCell>
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                  {padBottom > 0 && (
                    <tr aria-hidden="true">
                      <td colSpan={visibleCols} style={{ height: padBottom, padding: 0 }} />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          <p className="border-t border-border px-3 py-2 text-small text-muted" aria-live="polite">
            {rows.length} of {(sheets.data ?? []).length} sheets{selected.size ? ` · ${selected.size} selected` : ""}
          </p>
        </DataState>
      </div>

      <Drawer open={uploading} onOpenChange={setUploading} title="Upload PDFs">
        {uploading && <UploadPdfs projectId={project.id} sheets={sheets.data ?? []} onDone={() => setUploading(false)} />}
      </Drawer>
      <Drawer open={creating} onOpenChange={setCreating} title="Add sheet">
        {creating && <SheetForm onDone={() => setCreating(false)} />}
      </Drawer>
    </div>
  );
}


function Flags({ sheet }: { sheet: Sheet }) {
  if (!sheet.flags?.length) return null;
  return (
    <span className="flex gap-1">
      {sheet.flags.map((f) => {
        const pill = flagFor(f);
        return <FlagPill key={f.kind} kind={pill.kind} text={pill.text} detail={pill.detail} />;
      })}
    </span>
  );
}

/** Inline edit for owner, checker, planned date and package; saves on change with Undo. */
function EditableCell({ column, sheet, canEdit, children }: { column: string; sheet: Sheet; canEdit: boolean; children: ReactNode }) {
  const { project } = useProjectContext();
  const members = useMembers(project.id);
  const packages = usePackages(project.id);
  const [editing, setEditing] = useState(false);
  const field: Editable | null =
    column === "owner" ? "owner" : column === "checker" ? "checker" : column === "planned" ? "planned_issue_date" : column === "package" ? "package" : null;
  const save = useSaveSheetField();

  if (column === "planned" && !editing) {
    const own = !!sheet.planned_issue_date;
    children = sheet.effective_planned_date ? (
      <span title={own ? undefined : "From the package date"} className={own ? undefined : "text-muted italic"}>{formatDate(sheet.effective_planned_date)}</span>
    ) : (
      <span className="text-muted">—</span>
    );
  }
  if (!canEdit || !field) return <>{children}</>;
  if (!editing) {
    return (
      <button type="button" data-edit className="w-full min-w-16 rounded-sm text-left hover:outline hover:outline-1 hover:outline-border" aria-label={`Edit ${column} for ${sheet.number}`} onClick={() => setEditing(true)}>
        {children}
        {!sheet[field] && column !== "planned" && <span className="text-muted">—</span>}
      </button>
    );
  }
  const finish = (value: string) => {
    setEditing(false);
    const previous = (sheet[field] ?? "") as string;
    if (value === previous) return;
    save(sheet, field, value || null, previous || null);
  };
  if (field === "planned_issue_date") {
    return <TextInput autoFocus type="date" aria-label={`Planned date for ${sheet.number}`} className="h-7 w-36" defaultValue={sheet.planned_issue_date ?? ""} onBlur={(e) => finish(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setEditing(false)} />;
  }
  const choices =
    field === "package"
      ? (packages.data ?? []).map((p) => ({ value: p.id, label: p.name }))
      : (members.data ?? []).map((m) => ({ value: m.user.id, label: m.user.short_name }));
  return (
    <Select autoFocus aria-label={`${COLUMN_LABELS[column]} for ${sheet.number}`} className="h-7 w-40" defaultValue={(sheet[field] as string) ?? ""} onChange={(e) => finish(e.target.value)} onBlur={() => setEditing(false)}>
      <option value="">—</option>
      {choices.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
    </Select>
  );
}

function useSaveSheetField() {
  const { project } = useProjectContext();
  const queryClient = useQueryClient();
  const toast = useToast();
  const mutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Schemas["PatchedSheetRequest"] }) =>
      unwrap(api.PATCH("/api/v1/sheets/{id}", { params: { path: { id } }, body })),
    onSettled: () => queryClient.invalidateQueries({ queryKey: projectKeys.sheets(project.id) }),
    onError: (e) => toast({ title: "Not saved", description: e.message }),
  });
  return (sheet: Sheet, field: Editable, value: string | null, previous: string | null) => {
    mutation.mutate(
      { id: sheet.id, body: { [field]: value } },
      {
        onSuccess: () =>
          toast({
            title: `${sheet.number}: ${COLUMN_LABELS[field === "planned_issue_date" ? "planned" : field]?.toLowerCase()} updated`,
            onUndo: () => mutation.mutate({ id: sheet.id, body: { [field]: previous } }),
          }),
      },
    );
  };
}

function ColumnChooser({ visibility, onChange }: { visibility: VisibilityState; onChange: (v: VisibilityState) => void }) {
  const ids = Object.keys(COLUMN_LABELS);
  const shown = ids.filter((id) => visibility[id] !== false);
  return (
    <div className="inline-flex items-center gap-1">
      <Columns3 size={14} aria-hidden="true" className="text-muted" />
      <MultiSelect
        label="Columns"
        options={ids.map((id) => ({ value: id, label: COLUMN_LABELS[id]! }))}
        value={shown}
        onChange={(v) => onChange(Object.fromEntries(ids.map((id) => [id, v.includes(id)])))}
      />
    </div>
  );
}

interface ViewConfig {
  params?: string;
  columns?: VisibilityState;
}

function SavedViews({ projectId, visibility, onApply }: { projectId: string; visibility: VisibilityState; onApply: (c: ViewConfig) => void }) {
  const [params] = useSearchParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const views = useQuery({
    queryKey: ["saved-views", projectId],
    queryFn: () => unwrap(api.GET("/api/v1/saved-views", { params: { query: { project: projectId } } })),
  });
  const save = useMutation({
    mutationFn: (name: string) =>
      unwrap(api.POST("/api/v1/saved-views", { body: { name, project: projectId, config: { params: params.toString(), columns: visibility } } })),
    onSuccess: (v) => {
      queryClient.invalidateQueries({ queryKey: ["saved-views", projectId] });
      toast({ title: `View “${v.name}” saved` });
    },
  });
  return (
    <div className="inline-flex items-center gap-1">
      <Select
        aria-label="Saved view"
        className="h-8 w-44 text-small"
        value=""
        onChange={(e) => {
          const view = views.data?.find((v) => v.id === e.target.value);
          if (view) onApply(view.config as ViewConfig);
        }}
      >
        <option value="">Saved views…</option>
        {(views.data ?? []).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
      </Select>
      <Popover.Root open={naming} onOpenChange={setNaming}>
        <Popover.Trigger asChild>
          <Button size="sm" variant="ghost" icon={<Save size={14} aria-hidden="true" />}>Save view</Button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content align="end" sideOffset={4} className="z-50 w-72 rounded-md border border-border bg-surface p-3 shadow-overlay">
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (name.trim()) save.mutate(name.trim(), { onSuccess: () => { setNaming(false); setName(""); } });
              }}
            >
              <label htmlFor="view-name" className="text-small font-semibold text-muted">View name</label>
              <TextInput id="view-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. My HVAC" />
              <Button type="submit" size="sm" variant="primary" busy={save.isPending} disabled={!name.trim()}>Save view</Button>
            </form>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
