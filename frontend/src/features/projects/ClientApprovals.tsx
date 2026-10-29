import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Dialog";
import { Field, TextInput } from "@/components/ui/Field";
import { Card, tableClass, tdClass, thClass } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { api, unwrap } from "@/lib/api/client";
import { formatDate, todayISO } from "@/lib/format";
import { uploadFile } from "@/lib/upload";

import { projectKeys } from "./api";
import { useProjectContext } from "./ProjectLayout";

export const approvalKey = (projectId: string) => ["projects", projectId, "approvals"] as const;

/** F-26: client approvals per stage with their evidence. */
export function ClientApprovals() {
  const { project } = useProjectContext();
  const approvals = useQuery({
    queryKey: approvalKey(project.id),
    queryFn: () => unwrap(api.GET("/api/v1/projects/{project_pk}/approvals", { params: { path: { project_pk: project.id } } })),
  });
  const rows = approvals.data ?? [];
  if (rows.length === 0) return null;
  return (
    <Card title="Client approvals">
      <table className={tableClass}>
        <thead>
          <tr>
            <th scope="col" className={thClass}>Stage</th>
            <th scope="col" className={thClass}>Approved by</th>
            <th scope="col" className={thClass}>On</th>
            <th scope="col" className={thClass}>Evidence</th>
            <th scope="col" className={thClass}>Recorded by</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id}>
              <td className={tdClass}>{a.stage_name}</td>
              <td className={tdClass}>{a.approved_by}{a.note && <span className="block text-small text-muted">{a.note}</span>}</td>
              <td className={`${tdClass} tabular`}>{formatDate(a.approved_on)}</td>
              <td className={tdClass}><a className="text-primary underline" href={a.evidence_link.url} target="_blank" rel="noopener noreferrer">{a.evidence_link.name}</a></td>
              <td className={tdClass}>{a.recorded_by_detail.short_name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

/** PL records who approved the stage, when, and attaches the letter or email (F-26). */
export function RecordApprovalButton({ stageId, stageName }: { stageId: string; stageName: string }) {
  const { project } = useProjectContext();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [by, setBy] = useState("");
  const [on, setOn] = useState(todayISO());
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string>();
  const save = useMutation({
    mutationFn: async () => {
      const upload = await uploadFile(file!, file!.type.startsWith("image/") ? "image" : "document");
      return unwrap(api.POST("/api/v1/stages/{id}/approval", { params: { path: { id: stageId } }, body: { approved_by: by, approved_on: on, evidence_upload_id: upload.id, note } }));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: approvalKey(project.id) });
      queryClient.invalidateQueries({ queryKey: projectKeys.stages(project.id) });
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(project.id) });
      toast({ title: `Client approval recorded for ${stageName}` });
      setOpen(false);
    },
    onError: (e) => setError(e.message),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(undefined);
    if (!file) return setError("Attach the approval letter or email (PDF or image).");
    save.mutate();
  };
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>Record client approval</Button>
      <Drawer open={open} onOpenChange={setOpen} title={`Client approval · ${stageName}`}>
        <form className="flex flex-col gap-3" onSubmit={submit}>
          <Field label="Approved by" hint="Name and role on the client side.">{(p) => <TextInput {...p} required value={by} onChange={(e) => setBy(e.target.value)} />}</Field>
          <Field label="Approved on">{(p) => <TextInput {...p} type="date" required value={on} max={todayISO()} onChange={(e) => setOn(e.target.value)} />}</Field>
          <Field label="Evidence" hint="The approval letter, signed drawing or email (PDF or image).">
            {(p) => <input {...p} type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />}
          </Field>
          <Field label="Note (optional)">{(p) => <TextInput {...p} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
          <p className="text-small text-muted">If the stage's deliverables are issued it moves to Client approved; otherwise it moves when they are.</p>
          {error && <p role="alert" className="text-small text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" busy={save.isPending}>Record approval</Button>
          </div>
        </form>
      </Drawer>
    </>
  );
}
