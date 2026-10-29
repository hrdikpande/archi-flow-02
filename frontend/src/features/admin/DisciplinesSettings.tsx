import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog, Drawer } from "@/components/ui/Dialog";
import { Field, TextInput } from "@/components/ui/Field";
import { Card, PageHeader, tableClass, tdClass, thClass } from "@/components/ui/PageHeader";
import { DataState, EmptyState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, type Schemas, unwrap } from "@/lib/api/client";

type Discipline = Schemas["Discipline"];

/** S-14 Disciplines (F-42): codes and sheet-number prefix rules (used by F-35 in S3). */
export function DisciplinesSettings() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const query = useQuery({ queryKey: ["disciplines"], queryFn: () => unwrap(api.GET("/api/v1/disciplines")) });
  const [editing, setEditing] = useState<Discipline | "new" | null>(null);
  const [deleting, setDeleting] = useState<Discipline | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE("/api/v1/disciplines/{id}", { params: { path: { id } } })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["disciplines"] });
      toast({ title: `Discipline ${deleting?.code} deleted` });
      setDeleting(null);
    },
  });

  const rows = query.data ?? [];
  return (
    <>
      <PageHeader
        title="Disciplines"
        meta="Each discipline has a code used as the sheet-number prefix, e.g. A-101, M-205."
        actions={
          <Button variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => setEditing("new")}>
            Add discipline
          </Button>
        }
      />
      <Card>
        <DataState
          isPending={query.isPending}
          error={query.error}
          isEmpty={rows.length === 0}
          onRetry={() => query.refetch()}
          empty={<EmptyState message="No disciplines yet." action={<Button variant="primary" onClick={() => setEditing("new")}>Add discipline</Button>} />}
        >
          <table className={tableClass}>
            <thead>
              <tr>
                <th scope="col" className={thClass}>Code</th>
                <th scope="col" className={thClass}>Name</th>
                <th scope="col" className={thClass}>Sheet-number rule</th>
                <th scope="col" className={thClass}>Status</th>
                <th scope="col" className={thClass}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id} className="hover:bg-surface-muted">
                  <td className={tdClass}><span className="mono font-semibold">{d.code}</span></td>
                  <td className={tdClass}>
                    <button type="button" className="text-left text-primary underline-offset-2 hover:underline" onClick={() => setEditing(d)}>
                      {d.name}
                    </button>
                  </td>
                  <td className={tdClass}><span className="mono text-small">{d.sheet_prefix_regex || "—"}</span></td>
                  <td className={tdClass}>{d.is_active === false ? "Not in use" : "In use"}</td>
                  <td className={`${tdClass} text-right`}>
                    <Button size="sm" variant="ghost" aria-label={`Delete ${d.name}`} onClick={() => setDeleting(d)}>
                      <Trash2 size={14} aria-hidden="true" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </Card>
      <Drawer open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} title={editing === "new" ? "Add discipline" : "Edit discipline"}>
        {editing !== null && <DisciplineForm discipline={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}
      </Drawer>
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete discipline ${deleting?.code}?`}
        confirmLabel="Delete discipline"
        destructive
        busy={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      >
        <p>
          {deleting?.name} will be removed from the list. Once sheets use a discipline it can no longer be deleted; mark it “not in use” instead.
        </p>
        {remove.error && <p className="mt-2 text-danger">{remove.error.message}</p>}
      </ConfirmDialog>
    </>
  );
}

function DisciplineForm({ discipline, onDone }: { discipline: Discipline | null; onDone: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [code, setCode] = useState(discipline?.code ?? "");
  const [name, setName] = useState(discipline?.name ?? "");
  const [regex, setRegex] = useState(discipline?.sheet_prefix_regex ?? "");
  const [active, setActive] = useState(discipline?.is_active ?? true);
  const [sample, setSample] = useState("");

  const save = useMutation({
    mutationFn: (body: Schemas["DisciplineRequest"]) =>
      discipline
        ? unwrap(api.PATCH("/api/v1/disciplines/{id}", { params: { path: { id: discipline.id } }, body }))
        : unwrap(api.POST("/api/v1/disciplines", { body })),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["disciplines"] });
      toast({ title: `${saved.code} ${saved.name} saved` });
      onDone();
    },
  });
  const error = save.error instanceof ApiError ? save.error : null;

  let regexValid = true;
  let matches: boolean | null = null;
  try {
    const re = regex ? new RegExp(regex) : null;
    matches = re && sample ? re.test(sample) : null;
  } catch {
    regexValid = false;
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate({ code, name, sheet_prefix_regex: regex, is_active: active });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {error && !error.field("code") && !error.field("name") && <p role="alert" className="text-small text-danger">{error.message}</p>}
      <Field label="Code" hint="1–3 capital letters, for example A or M." error={error?.field("code") ?? error?.field("non_field_errors")}>
        {(a) => <TextInput {...a} required maxLength={3} className="mono uppercase" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />}
      </Field>
      <Field label="Name" error={error?.field("name")}>
        {(a) => <TextInput {...a} required value={name} onChange={(e) => setName(e.target.value)} />}
      </Field>
      <Field
        label="Sheet-number rule (regular expression)"
        hint={<>For example <span className="mono">^A-\d{"{3}"}$</span> accepts A-101.</>}
        error={!regexValid ? "This is not a valid pattern." : error?.field("sheet_prefix_regex")}
      >
        {(a) => <TextInput {...a} className="mono" value={regex} onChange={(e) => setRegex(e.target.value)} />}
      </Field>
      <Field
        label="Try a sheet number"
        hint={matches === null ? "Type a number to test the rule." : matches ? `✓ ${sample} matches the rule.` : `✗ ${sample} does not match the rule.`}
      >
        {(a) => <TextInput {...a} className="mono" value={sample} onChange={(e) => setSample(e.target.value)} />}
      </Field>
      <label className="flex items-center gap-2 text-body">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        In use for new sheets
      </label>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" busy={save.isPending} disabled={!code || !name || !regexValid}>
          Save discipline
        </Button>
        <Button onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}
