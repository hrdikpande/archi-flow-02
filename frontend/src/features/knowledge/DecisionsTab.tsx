import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Dialog";
import { Field, TextInput } from "@/components/ui/Field";
import { Card } from "@/components/ui/PageHeader";
import { DataState, EmptyState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { LinkedSheets, SheetsPicker, useOpenParam } from "@/features/construction/common";
import { useProjectContext } from "@/features/projects/ProjectLayout";
import { api, type Schemas, unwrap } from "@/lib/api/client";
import { formatDate, todayISO } from "@/lib/format";

const key = (projectId: string) => ["projects", projectId, "decisions"] as const;

/** F-58 decision log: what was decided, when, by whom, for which sheets. Searchable firm-wide. */
export function DecisionsTab() {
  const { project } = useProjectContext();
  const decisions = useQuery({ queryKey: key(project.id), queryFn: () => unwrap(api.GET("/api/v1/projects/{project_pk}/decisions", { params: { path: { project_pk: project.id } } })) });
  const [openId] = useOpenParam();
  const [logging, setLogging] = useState(false);
  const rows = decisions.data ?? [];
  return (
    <>
      <Card title="Decisions" actions={project.my_permissions.log_decisions && <Button size="sm" variant="primary" icon={<Plus size={14} aria-hidden="true" />} onClick={() => setLogging(true)}>Log decision</Button>}>
        <DataState isPending={decisions.isPending} error={decisions.error} isEmpty={rows.length === 0} onRetry={() => decisions.refetch()} empty={<EmptyState message="No decisions logged yet." />}>
          <ul className="divide-y divide-border">
            {rows.map((d) => (
              <li key={d.id} id={`decision-${d.id}`} className={`flex flex-col gap-1 px-4 py-3 ${openId === d.id ? "bg-surface-muted" : ""}`}>
                <p className="font-semibold"><span className="mono">{d.number.split("-").slice(-2).join("-")}</span> {d.title}</p>
                <p className="whitespace-pre-wrap text-body">{d.text}</p>
                <p className="text-small text-muted">
                  {formatDate(d.decided_on)}{d.decided_by && ` · ${d.decided_by}`} · logged by {d.logged_by_detail?.short_name}
                  {(d.tags ?? []).length > 0 && ` · ${(d.tags ?? []).join(", ")}`}
                </p>
                <LinkedSheets refs={d.sheet_refs} />
              </li>
            ))}
          </ul>
        </DataState>
      </Card>
      {logging && <LogDecision onClose={() => setLogging(false)} />}
    </>
  );
}

function LogDecision({ onClose }: { onClose: () => void }) {
  const { project } = useProjectContext();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({ title: "", text: "", decided_on: todayISO(), decided_by: "", tags: "" });
  const [sheets, setSheets] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const save = useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/projects/{project_pk}/decisions", {
      params: { path: { project_pk: project.id } },
      body: { ...form, tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean), sheets } as Schemas["DecisionRequest"],
    })),
    onSuccess: (d) => {
      queryClient.invalidateQueries({ queryKey: key(project.id) });
      toast({ title: `${d.number} logged` });
      onClose();
    },
    onError: (e) => setError(e.message),
  });
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });
  return (
    <Drawer open onOpenChange={(o) => !o && onClose()} title="Log decision">
      <form className="flex flex-col gap-3" onSubmit={(e: FormEvent) => { e.preventDefault(); setError(undefined); save.mutate(); }}>
        <Field label="Decision">{(p) => <TextInput {...p} required maxLength={300} value={form.title} onChange={set("title")} />}</Field>
        <Field label="Details">{(p) => <textarea {...p} required rows={4} className="rounded-sm border border-border bg-surface p-2" value={form.text} onChange={set("text")} />}</Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Decided on">{(p) => <TextInput {...p} type="date" required value={form.decided_on} onChange={set("decided_on")} />}</Field>
          <Field label="Decided by">{(p) => <TextInput {...p} value={form.decided_by} placeholder="Client meeting" onChange={set("decided_by")} />}</Field>
        </div>
        <Field label="Tags" hint="Comma separated, e.g. OT, HEPA">{(p) => <TextInput {...p} value={form.tags} onChange={set("tags")} />}</Field>
        <SheetsPicker value={sheets} onChange={setSheets} />
        {error && <p role="alert" className="text-small text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" busy={save.isPending}>Log decision</Button>
        </div>
      </form>
    </Drawer>
  );
}
