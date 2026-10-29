import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Field, Select, TextInput } from "@/components/ui/Field";
import { Card, PageHeader, tableClass, tdClass, thClass } from "@/components/ui/PageHeader";
import { DataState, EmptyState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { useDisciplines } from "@/features/projects/api";
import { api, type Schemas, unwrap } from "@/lib/api/client";

type Checklist = Schemas["Checklist"];
type Item = { text: string; mandatory: boolean };

/** S-19 checklist builder (F-13): designer pre-checks per discipline and stage. */
export function ChecklistSettings() {
  const lists = useQuery({ queryKey: ["checklists"], queryFn: () => unwrap(api.GET("/api/v1/checklists")) });
  const [editing, setEditing] = useState<Checklist | "new" | null>(null);
  const [deleting, setDeleting] = useState<Checklist | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();
  const remove = useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE("/api/v1/checklists/{id}", { params: { path: { id } } })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklists"] });
      toast({ title: `${deleting?.name} deleted` });
      setDeleting(null);
    },
  });
  const rows = lists.data ?? [];

  return (
    <>
      <PageHeader title="Checklists" meta="Ticked by the designer in the Submit dialog. Required items block submit until ticked." actions={<Button variant="primary" icon={<Plus size={14} aria-hidden="true" />} onClick={() => setEditing("new")}>New checklist</Button>} />
      <div className="flex flex-col gap-4">
        <Card>
          <DataState isPending={lists.isPending} error={lists.error} isEmpty={rows.length === 0} onRetry={() => lists.refetch()} empty={<EmptyState message="No checklists yet." />}>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th scope="col" className={thClass}>Checklist</th>
                  <th scope="col" className={thClass}>Discipline</th>
                  <th scope="col" className={thClass}>Stages</th>
                  <th scope="col" className={`${thClass} text-right`}>Items</th>
                  <th scope="col" className={thClass}>Status</th>
                  <th scope="col" className={thClass}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td className={tdClass}>{c.name}</td>
                    <td className={tdClass}>{c.discipline_code ?? "All"}</td>
                    <td className={tdClass}>{c.stage_names?.length ? c.stage_names.join(", ") : "All stages"}</td>
                    <td className={`${tdClass} text-right tabular`}>{c.items.length} ({c.items.filter((i) => i.mandatory).length} required)</td>
                    <td className={tdClass}>{c.is_active ? "Active" : "Off"}</td>
                    <td className={`${tdClass} text-right`}>
                      <Button size="sm" onClick={() => setEditing(c)}>Edit</Button>{" "}
                      <Button size="sm" variant="ghost" aria-label={`Delete ${c.name}`} icon={<Trash2 size={14} aria-hidden="true" />} onClick={() => setDeleting(c)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataState>
        </Card>
        {editing && <ChecklistForm key={editing === "new" ? "new" : editing.id} checklist={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}
      </div>
      <ConfirmDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} title={`Delete ${deleting?.name}?`} confirmLabel="Delete checklist" destructive busy={remove.isPending} onConfirm={() => deleting && remove.mutate(deleting.id)}>
        Sheets already submitted keep their ticks. New submissions will no longer show this list.
      </ConfirmDialog>
    </>
  );
}

function ChecklistForm({ checklist, onDone }: { checklist: Checklist | null; onDone: () => void }) {
  const disciplines = useDisciplines();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState(checklist?.name ?? "");
  const [discipline, setDiscipline] = useState(checklist?.discipline ?? "");
  const [stages, setStages] = useState((checklist?.stage_names ?? []).join(", "));
  const [active, setActive] = useState(checklist?.is_active ?? true);
  const [items, setItems] = useState<Item[]>(checklist?.items.map((i) => ({ text: i.text, mandatory: !!i.mandatory })) ?? [{ text: "", mandatory: true }]);
  const [error, setError] = useState<string>();
  const save = useMutation({
    mutationFn: () => {
      const body = {
        name,
        discipline: discipline || null,
        stage_names: stages.split(",").map((s) => s.trim()).filter(Boolean),
        is_active: active,
        items: items.filter((i) => i.text.trim()),
      };
      return checklist
        ? unwrap(api.PUT("/api/v1/checklists/{id}", { params: { path: { id: checklist.id } }, body }))
        : unwrap(api.POST("/api/v1/checklists", { body }));
    },
    onSuccess: (c) => {
      queryClient.invalidateQueries({ queryKey: ["checklists"] });
      toast({ title: `${c.name} saved` });
      onDone();
    },
    onError: (e) => setError(e.message),
  });
  const move = (i: number, by: number) => {
    const next = [...items];
    const [x] = next.splice(i, 1);
    next.splice(i + by, 0, x!);
    setItems(next);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(undefined);
    save.mutate();
  };

  return (
    <Card title={checklist ? `Edit ${checklist.name}` : "New checklist"}>
      <form className="flex flex-col gap-3 p-4" onSubmit={submit}>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Name">{(p) => <TextInput {...p} value={name} required maxLength={120} onChange={(e) => setName(e.target.value)} />}</Field>
          <Field label="Discipline">
            {(p) => (
              <Select {...p} value={discipline} onChange={(e) => setDiscipline(e.target.value)}>
                <option value="">All disciplines</option>
                {disciplines.data?.map((d) => <option key={d.id} value={d.id}>{d.code} · {d.name}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Stages" hint="Stage names, comma-separated; empty = all stages.">
            {(p) => <TextInput {...p} value={stages} placeholder="Working drawings / GFC" onChange={(e) => setStages(e.target.value)} />}
          </Field>
        </div>
        <label className="inline-flex items-center gap-2 text-body"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active</label>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-body font-semibold">Items</legend>
          {items.map((it, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <TextInput aria-label={`Item ${i + 1}`} className="min-w-64 flex-1" value={it.text} maxLength={300} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
              <label className="inline-flex items-center gap-1 text-small"><input type="checkbox" checked={it.mandatory} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, mandatory: e.target.checked } : x)))} /> Required</label>
              <Button size="sm" variant="ghost" aria-label={`Move item ${i + 1} up`} disabled={i === 0} icon={<ArrowUp size={14} aria-hidden="true" />} onClick={() => move(i, -1)} />
              <Button size="sm" variant="ghost" aria-label={`Move item ${i + 1} down`} disabled={i === items.length - 1} icon={<ArrowDown size={14} aria-hidden="true" />} onClick={() => move(i, 1)} />
              <Button size="sm" variant="ghost" aria-label={`Remove item ${i + 1}`} icon={<Trash2 size={14} aria-hidden="true" />} onClick={() => setItems(items.filter((_, j) => j !== i))} />
            </div>
          ))}
          <Button size="sm" className="w-fit" icon={<Plus size={14} aria-hidden="true" />} onClick={() => setItems([...items, { text: "", mandatory: true }])}>Add item</Button>
        </fieldset>
        {error && <p role="alert" className="text-small text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button onClick={onDone}>Cancel</Button>
          <Button type="submit" variant="primary" busy={save.isPending}>Save checklist</Button>
        </div>
      </form>
    </Card>
  );
}
