import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Dialog";
import { Field, TextInput } from "@/components/ui/Field";
import { Card, PageHeader, tableClass, tdClass, thClass } from "@/components/ui/PageHeader";
import { DataState, EmptyState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { api, type Schemas, unwrap } from "@/lib/api/client";

type Template = Schemas["StageTemplate"];
interface Item {
  name: string;
  fee_pct: string;
}

/** S-14 Stage templates (F-02, F-42). Default percentages are placeholders until the owner
 * confirms them (AS-05, DEC-05). */
export function StageTemplatesSettings() {
  const templates = useQuery({ queryKey: ["stage-templates"], queryFn: () => unwrap(api.GET("/api/v1/stage-templates")) });
  const [editing, setEditing] = useState<Template | "new" | null>(null);
  const list = templates.data ?? [];
  return (
    <>
      <PageHeader title="Stage templates" meta="Applied when a project lead sets up a project's fee stages." actions={<Button variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => setEditing("new")}>Add template</Button>} />
      <Card>
        <DataState isPending={templates.isPending} error={templates.error} isEmpty={list.length === 0} onRetry={() => templates.refetch()} empty={<EmptyState message="No stage templates yet." />}>
          <table className={tableClass}>
            <thead>
              <tr>
                <th scope="col" className={thClass}>Template</th>
                <th scope="col" className={thClass}>Stages</th>
                <th scope="col" className={`${thClass} text-right`}>Fee total</th>
              </tr>
            </thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.id}>
                  <td className={tdClass}>
                    <button type="button" className="text-primary hover:underline" onClick={() => setEditing(t)}>{t.name}</button>
                    {t.is_default && <span className="ml-2 text-small text-muted">Default</span>}
                  </td>
                  <td className={`${tdClass} text-small`}>{t.items.map((i) => i.name).join(" · ")}</td>
                  <td className={`${tdClass} text-right tabular`} style={Number(t.fee_total) === 100 ? undefined : { color: "var(--flag-at_risk-fg)" }}>{Number(t.fee_total).toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </Card>
      <Drawer open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} title={editing === "new" ? "Add stage template" : "Edit stage template"}>
        {editing !== null && <TemplateForm template={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}
      </Drawer>
    </>
  );
}

function TemplateForm({ template, onDone }: { template: Template | null; onDone: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState(template?.name ?? "");
  const [isDefault, setIsDefault] = useState(template?.is_default ?? false);
  const [items, setItems] = useState<Item[]>(template?.items.map((i) => ({ name: i.name, fee_pct: String(i.fee_pct) })) ?? [{ name: "", fee_pct: "0" }]);
  const total = items.reduce((s, i) => s + (Number(i.fee_pct) || 0), 0);
  const save = useMutation({
    mutationFn: () => {
      const body = { name, is_default: isDefault, items: items.map((i) => ({ name: i.name, fee_pct: i.fee_pct || "0" })) };
      return template
        ? unwrap(api.PATCH("/api/v1/stage-templates/{id}", { params: { path: { id: template.id } }, body }))
        : unwrap(api.POST("/api/v1/stage-templates", { body }));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stage-templates"] });
      toast({ title: `${name} saved` });
      onDone();
    },
  });
  const update = (i: number, patch: Partial<Item>) => setItems((l) => l.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {save.error && <p role="alert" className="text-small text-danger">{save.error.message}</p>}
      <Field label="Name">{(a) => <TextInput {...a} required value={name} onChange={(e) => setName(e.target.value)} />}</Field>
      <label className="flex items-center gap-2 text-body">
        <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} /> Default template
      </label>
      <table className={tableClass}>
        <thead>
          <tr>
            <th scope="col" className={thClass}>Stage</th>
            <th scope="col" className={`${thClass} text-right`}>Fee %</th>
            <th scope="col" className={thClass}><span className="sr-only">Remove</span></th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i}>
              <td className={tdClass}><TextInput aria-label={`Stage ${i + 1} name`} value={it.name} onChange={(e) => update(i, { name: e.target.value })} /></td>
              <td className={`${tdClass} text-right`}><TextInput aria-label={`Stage ${i + 1} fee %`} type="number" min={0} max={100} step={0.01} className="w-24 text-right" value={it.fee_pct} onChange={(e) => update(i, { fee_pct: e.target.value })} /></td>
              <td className={tdClass}><Button size="sm" variant="ghost" aria-label={`Remove stage ${i + 1}`} onClick={() => setItems((l) => l.filter((_, j) => j !== i))}><Trash2 size={14} aria-hidden="true" /></Button></td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" className="px-3 py-2 text-right text-small text-muted">Total</th>
            <td className="px-3 py-2 text-right font-semibold tabular">{total.toFixed(2)}%</td>
            <td />
          </tr>
        </tfoot>
      </table>
      <Button size="sm" className="self-start" icon={<Plus size={14} aria-hidden="true" />} onClick={() => setItems((l) => [...l, { name: "", fee_pct: "0" }])}>Add stage</Button>
      <p className="text-small text-muted">Templates may total less than 100%; a project's plan must total 100% to be saved as final.</p>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" busy={save.isPending} disabled={!name || items.some((i) => !i.name)}>Save template</Button>
        <Button onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}
