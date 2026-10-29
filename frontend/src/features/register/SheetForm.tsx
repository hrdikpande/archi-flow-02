import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Field, Select, TextInput } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, unwrap } from "@/lib/api/client";
import { projectKeys, useDisciplines, useMembers, usePackages, useStages } from "@/features/projects/api";
import { useProjectContext } from "@/features/projects/ProjectLayout";

import type { Sheet } from "./useSheets";

/** Add or edit a sheet (F-04). The number is checked against the discipline rule (F-35). */
export function SheetForm({ sheet, onDone }: { sheet?: Sheet; onDone: () => void }) {
  const { project } = useProjectContext();
  const queryClient = useQueryClient();
  const toast = useToast();
  const disciplines = useDisciplines();
  const stages = useStages(project.id);
  const members = useMembers(project.id);
  const packages = usePackages(project.id);
  const [number, setNumber] = useState(sheet?.number ?? "");
  const [title, setTitle] = useState(sheet?.title ?? "");
  const [discipline, setDiscipline] = useState(sheet?.discipline ?? "");
  const [stage, setStage] = useState(sheet?.stage ?? "");
  const [pkg, setPkg] = useState(sheet?.package ?? "");
  const [owner, setOwner] = useState(sheet?.owner ?? "");
  const [checker, setChecker] = useState(sheet?.checker ?? "");
  const [planned, setPlanned] = useState(sheet?.planned_issue_date ?? "");
  const [cad, setCad] = useState(sheet?.cad_link ?? "");

  const save = useMutation({
    mutationFn: () => {
      const body = {
        number,
        title,
        discipline,
        stage,
        package: pkg || null,
        owner: owner || null,
        checker: checker || null,
        planned_issue_date: planned || null,
        cad_link: cad,
      };
      return sheet
        ? unwrap(api.PATCH("/api/v1/sheets/{id}", { params: { path: { id: sheet.id } }, body }))
        : unwrap(api.POST("/api/v1/projects/{project_pk}/sheets", { params: { path: { project_pk: project.id } }, body }));
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.sheets(project.id) });
      queryClient.invalidateQueries({ queryKey: ["sheet", saved.id] });
      toast({ title: `${saved.number} ${sheet ? "saved" : "added"}` });
      onDone();
    },
  });
  const error = save.error instanceof ApiError ? save.error : null;
  const fieldError = (name: string) => error?.field(name) ?? (error?.body.field === name ? error.message : undefined);
  const generalError = error && !["number", "owner", "checker", "cad_link", "stage", "package"].includes(String(error.body.field)) && !Object.keys(error.errors).length ? error.message : null;
  const people = members.data ?? [];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {generalError && <p role="alert" className="text-small text-danger">{generalError}</p>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Sheet number" error={fieldError("number")}>{(a) => <TextInput {...a} required className="mono" value={number} onChange={(e) => setNumber(e.target.value)} />}</Field>
        <Field label="Discipline" error={fieldError("discipline")}>
          {(a) => (
            <Select {...a} required value={discipline} onChange={(e) => setDiscipline(e.target.value)}>
              <option value="">Choose…</option>
              {(disciplines.data ?? []).filter((d) => d.is_active !== false).map((d) => <option key={d.id} value={d.id}>{d.code} {d.name}</option>)}
            </Select>
          )}
        </Field>
      </div>
      <Field label="Title" error={fieldError("title")}>{(a) => <TextInput {...a} required value={title} onChange={(e) => setTitle(e.target.value)} />}</Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Stage" error={fieldError("stage")}>
          {(a) => (
            <Select {...a} required value={stage} onChange={(e) => setStage(e.target.value)}>
              <option value="">Choose…</option>
              {(stages.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.seq} {s.name}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Package" error={fieldError("package")}>
          {(a) => (
            <Select {...a} value={pkg} onChange={(e) => setPkg(e.target.value)}>
              <option value="">None</option>
              {(packages.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Owner (designer)" error={fieldError("owner")}>
          {(a) => (
            <Select {...a} value={owner} onChange={(e) => setOwner(e.target.value)}>
              <option value="">Not assigned</option>
              {people.map((m) => <option key={m.user.id} value={m.user.id}>{m.user.full_name || m.user.email}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Checker" error={fieldError("checker")}>
          {(a) => (
            <Select {...a} value={checker} onChange={(e) => setChecker(e.target.value)}>
              <option value="">Not assigned</option>
              {people.map((m) => <option key={m.user.id} value={m.user.id}>{m.user.full_name || m.user.email}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Planned issue date" hint="Leave empty to use the package date.">
          {(a) => <TextInput {...a} type="date" value={planned} onChange={(e) => setPlanned(e.target.value)} />}
        </Field>
      </div>
      <Field label="CAD file location" hint="Network path or SharePoint / Drive / Autodesk link. The file is linked, not copied." error={fieldError("cad_link")}>
        {(a) => <TextInput {...a} value={cad} onChange={(e) => setCad(e.target.value)} placeholder={"\\\\fileserver\\2026-014\\ARCH\\A-101.dwg"} />}
      </Field>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" busy={save.isPending} disabled={!number || !title || !discipline || !stage}>{sheet ? "Save sheet" : "Add sheet"}</Button>
        <Button onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}
