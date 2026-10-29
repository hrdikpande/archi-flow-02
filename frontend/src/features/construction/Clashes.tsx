import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleDot, Hammer, Upload, Wrench } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Dialog";
import { Field, Select } from "@/components/ui/Field";
import { Card, tableClass, tdClass, thClass } from "@/components/ui/PageHeader";
import { DataState, EmptyState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { useDisciplines } from "@/features/projects/api";
import { useProjectContext } from "@/features/projects/ProjectLayout";
import { api, type Schemas, unwrap } from "@/lib/api/client";
import { formatDateTime } from "@/lib/format";
import { uploadFile } from "@/lib/upload";

import { LinkedSheets, MemberSelect, Pill, SheetsPicker, useOpenParam } from "./common";

type Clash = Schemas["ClashIssue"];

const STATUS = {
  open: { label: "Open", icon: CircleDot, tone: "changes_requested" },
  in_progress: { label: "In progress", icon: Hammer, tone: "in_check" },
  resolved: { label: "Resolved", icon: Wrench, tone: "approved_for_issue" },
  closed: { label: "Closed", icon: CheckCircle2, tone: "issued" },
} as const;

const key = (projectId: string) => ["projects", projectId, "clashes"] as const;

/** S-21 clash issues (F-34): import BCF 2.1/3.0 or a Navisworks XML report; re-import updates. */
export function Clashes() {
  const { project } = useProjectContext();
  const queryClient = useQueryClient();
  const toast = useToast();
  const clashes = useQuery({ queryKey: key(project.id), queryFn: () => unwrap(api.GET("/api/v1/projects/{project_pk}/clashes", { params: { path: { project_pk: project.id } } })) });
  const [openId, setOpen] = useOpenParam();
  const [error, setError] = useState<string>();
  const importFile = useMutation({
    mutationFn: async (file: File) => {
      const type = file.name.toLowerCase().endsWith(".xml") ? "application/xml" : "application/zip";
      const upload = await uploadFile(new File([file], file.name, { type }), "data");
      return unwrap(api.POST("/api/v1/projects/{project_pk}/clash-imports", { params: { path: { project_pk: project.id } }, body: { upload_id: upload.id } }));
    },
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: key(project.id) });
      const c = job.counts as { created?: number; updated?: number };
      toast({ title: `${job.original_name} imported`, description: `${c.created ?? 0} new, ${c.updated ?? 0} updated` });
    },
    onError: (e) => setError(e.message),
  });
  const rows = clashes.data ?? [];
  const open = rows.find((r) => r.id === openId) ?? null;
  return (
    <>
      <Card
        title="Clash issues"
        actions={project.my_permissions.manage_clashes && (
          <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-sm bg-primary px-3 text-small font-semibold text-on-primary">
            <Upload size={14} aria-hidden="true" /> {importFile.isPending ? "Importing…" : "Import BCF or Navisworks XML"}
            <input type="file" accept=".bcfzip,.bcf,.xml" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setError(undefined); importFile.mutate(f); } e.target.value = ""; }} />
          </label>
        )}
      >
        {error && <p role="alert" className="px-4 pt-3 text-small text-danger">{error}</p>}
        <DataState isPending={clashes.isPending} error={clashes.error} isEmpty={rows.length === 0} onRetry={() => clashes.refetch()} empty={<EmptyState message="No clash results imported yet." />}>
          <div className="overflow-x-auto" role="region" aria-label="Clash issues" tabIndex={0}>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th scope="col" className={thClass}><span className="sr-only">Viewpoint</span></th>
                  <th scope="col" className={thClass}>Issue</th>
                  <th scope="col" className={thClass}>Discipline</th>
                  <th scope="col" className={thClass}>Assigned</th>
                  <th scope="col" className={thClass}>Sheets</th>
                  <th scope="col" className={thClass}>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const s = STATUS[r.status ?? "open"];
                  return (
                    <tr key={r.id}>
                      <td className={`${tdClass} w-20`}>{r.snapshot_link ? <img src={r.snapshot_link.url} alt="" className="h-10 w-16 rounded-sm object-cover" /> : null}</td>
                      <td className={tdClass}>
                        <button type="button" className="text-left hover:underline" onClick={() => setOpen(r.id)}>{r.title}</button>
                        <span className="block text-small text-muted">{r.source === "bcf" ? "BCF" : "Navisworks"}{r.priority && ` · ${r.priority}`}</span>
                      </td>
                      <td className={tdClass}>{r.discipline_code ?? "—"}</td>
                      <td className={tdClass}>{r.assignee_detail?.short_name ?? (r.assigned_to_text || "—")}</td>
                      <td className={tdClass}><LinkedSheets refs={r.sheet_refs} /></td>
                      <td className={tdClass}><Pill label={s.label} icon={s.icon} tone={s.tone} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DataState>
      </Card>
      {open && <ClashDrawer key={open.id} clash={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function ClashDrawer({ clash, onClose }: { clash: Clash; onClose: () => void }) {
  const { project } = useProjectContext();
  const queryClient = useQueryClient();
  const toast = useToast();
  const disciplines = useDisciplines();
  const [status, setStatus] = useState(clash.status ?? "open");
  const [discipline, setDiscipline] = useState(clash.discipline ?? "");
  const [assignee, setAssignee] = useState(clash.assignee ?? "");
  const [sheets, setSheets] = useState<string[]>(clash.sheets ?? []);
  const canEdit = !!project.my_permissions.manage_clashes;
  const save = useMutation({
    mutationFn: () => unwrap(api.PATCH("/api/v1/clashes/{id}", { params: { path: { id: clash.id } }, body: { status, discipline: discipline || null, assignee: assignee || null, sheets } })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key(project.id) });
      toast({ title: "Clash updated" });
      onClose();
    },
    onError: (e) => toast({ title: "Not saved", description: e.message }),
  });
  return (
    <Drawer open onOpenChange={(o) => !o && onClose()} title={clash.title}>
      <div className="flex flex-col gap-3 text-body">
        {clash.snapshot_link && <img src={clash.snapshot_link.url} alt={`Viewpoint of ${clash.title}`} className="w-full rounded-md border border-border" />}
        {clash.description && <p className="whitespace-pre-wrap">{clash.description}</p>}
        <p className="text-small text-muted">
          {clash.source === "bcf" ? "BCF" : "Navisworks"} status “{clash.source_status || "—"}”{clash.source_modified && ` · changed ${formatDateTime(clash.source_modified)}`}
          {(clash.labels as string[]).length > 0 && ` · ${(clash.labels as string[]).join(", ")}`}
        </p>
        {canEdit ? (
          <>
            <Field label="Status" hint="Once changed here, re-imports no longer overwrite it.">
              {(p) => <Select {...p} value={status} onChange={(e) => setStatus(e.target.value as keyof typeof STATUS)}>{Object.entries(STATUS).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}</Select>}
            </Field>
            <Field label="Discipline">{(p) => <Select {...p} value={discipline} onChange={(e) => setDiscipline(e.target.value)}><option value="">—</option>{disciplines.data?.map((d) => <option key={d.id} value={d.id}>{d.code} · {d.name}</option>)}</Select>}</Field>
            <Field label="Assigned to">{(p) => <MemberSelect {...p} value={assignee} onChange={setAssignee} />}</Field>
            <SheetsPicker value={sheets} onChange={setSheets} />
            <Button variant="primary" className="self-end" busy={save.isPending} onClick={() => save.mutate()}>Save</Button>
          </>
        ) : (
          <LinkedSheets refs={clash.sheet_refs} />
        )}
      </div>
    </Drawer>
  );
}
