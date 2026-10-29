import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Plus, Trash2, Upload } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { TextInput } from "@/components/ui/Field";
import { Card, tableClass, tdClass, thClass } from "@/components/ui/PageHeader";
import { StageChip } from "@/components/ui/StageChip";
import { DataState, EmptyState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, unwrap } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import { uploadFile } from "@/lib/upload";

import { projectKeys, type Stage, useStages } from "./api";
import { ClientApprovals, RecordApprovalButton } from "./ClientApprovals";
import { useProjectContext } from "./ProjectLayout";

interface Row {
  id?: string;
  seq: number;
  name: string;
  fee_pct: string;
  fee_amount: string;
  planned_start: string;
  planned_end: string;
  requires_senior_qc: boolean;
  state?: string;
  actual_start?: string | null;
  actual_end?: string | null;
  allowed_actions?: Stage["allowed_actions"];
  sheet_count?: number;
}

const toRow = (s: Stage): Row => ({
  id: s.id,
  seq: s.seq,
  name: s.name,
  fee_pct: String(s.fee_pct),
  fee_amount: s.fee_amount ?? "",
  planned_start: s.planned_start ?? "",
  planned_end: s.planned_end ?? "",
  requires_senior_qc: !!s.requires_senior_qc,
  state: s.state,
  actual_start: s.actual_start,
  actual_end: s.actual_end,
  allowed_actions: s.allowed_actions,
  sheet_count: s.sheet_count,
});

/** S-11: stages with fee %, dates, senior QC; footer total must be 100% to save as final. */
export function StagePlanEditor() {
  const { project } = useProjectContext();
  const query = useStages(project.id);
  return (
    <DataState isPending={query.isPending} error={query.error} isEmpty={false} empty={null} onRetry={() => query.refetch()}>
      {query.data && <Editor key={query.dataUpdatedAt} initial={query.data.map(toRow)} />}
      <div className="mt-4">
        <ClientApprovals />
      </div>
    </DataState>
  );
}

function Editor({ initial }: { initial: Row[] }) {
  const { project } = useProjectContext();
  const queryClient = useQueryClient();
  const toast = useToast();
  const canEdit = !!project.my_permissions.edit_project;
  const [rows, setRows] = useState<Row[]>(initial);
  const [confirmTemplate, setConfirmTemplate] = useState<string | null>(null);
  const templates = useQuery({ queryKey: ["stage-templates"], queryFn: () => unwrap(api.GET("/api/v1/stage-templates")), enabled: canEdit });
  const total = rows.reduce((sum, r) => sum + (Number(r.fee_pct) || 0), 0);
  const totalOk = Math.abs(total - 100) <= 0.01;
  const dirty = JSON.stringify(rows.map(({ allowed_actions: _a, state: _s, actual_start: _x, actual_end: _y, sheet_count: _c, ...r }) => r)) !==
    JSON.stringify(initial.map(({ allowed_actions: _a, state: _s, actual_start: _x, actual_end: _y, sheet_count: _c, ...r }) => r));

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: projectKeys.stages(project.id) });
    queryClient.invalidateQueries({ queryKey: projectKeys.detail(project.id) });
  };
  const save = useMutation({
    mutationFn: (final: boolean) =>
      unwrap(
        api.PUT("/api/v1/projects/{project_pk}/stages", {
          params: { path: { project_pk: project.id } },
          body: {
            final,
            stages: rows.map((r, i) => ({
              id: r.id ?? null,
              seq: i + 1,
              name: r.name,
              fee_pct: r.fee_pct || "0",
              fee_amount: r.fee_amount || null,
              planned_start: r.planned_start || null,
              planned_end: r.planned_end || null,
              requires_senior_qc: r.requires_senior_qc,
            })),
          },
        }),
      ),
    onSuccess: (_d, final) => {
      refresh();
      toast({ title: final ? "Stage plan saved as final" : "Stage plan saved as draft" });
    },
  });
  const apply = useMutation({
    mutationFn: (template: string) =>
      unwrap(api.POST("/api/v1/projects/{project_pk}/stages/apply-template", { params: { path: { project_pk: project.id } }, body: { template } })),
    onSuccess: () => {
      refresh();
      setConfirmTemplate(null);
      toast({ title: "Template applied", description: "Edit names, fee % and dates, then save." });
    },
  });
  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      unwrap(api.POST("/api/v1/stages/{id}/transitions", { params: { path: { id } }, body: { action } })),
    onSuccess: (stage) => {
      refresh();
      toast({ title: `${stage.name}: ${stage.state.replace(/_/g, " ")}` });
    },
    onError: (e) => toast({ title: "Not changed", description: e.message }),
  });
  const error = save.error instanceof ApiError ? save.error : apply.error instanceof ApiError ? apply.error : null;
  const update = (i: number, patch: Partial<Row>) => setRows((list) => list.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const defaultTemplate = templates.data?.find((t) => t.is_default) ?? templates.data?.[0];

  return (
    <div className="flex flex-col gap-4">
      <Card
        title="Fee stages"
        actions={
          canEdit && (
            <div className="flex flex-wrap gap-2">
              {defaultTemplate && (
                <Button size="sm" onClick={() => (rows.length ? setConfirmTemplate(defaultTemplate.id) : apply.mutate(defaultTemplate.id))}>
                  Apply template
                </Button>
              )}
              <Button
                size="sm"
                icon={<Plus size={14} aria-hidden="true" />}
                onClick={() => setRows((l) => [...l, { seq: l.length + 1, name: "", fee_pct: "0", fee_amount: "", planned_start: "", planned_end: "", requires_senior_qc: false }])}
              >
                Add stage
              </Button>
            </div>
          )
        }
      >
        {error && <p role="alert" className="mx-4 mt-3 rounded-sm bg-danger-bg px-3 py-2 text-small text-danger">{error.message}</p>}
        {rows.length === 0 ? (
          <EmptyState message="No stages yet. Apply the firm's stage template, then adjust fee % and dates from the appointment letter." />
        ) : (
          <div className="overflow-x-auto" role="region" aria-label="Stage plan" tabIndex={0}>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th scope="col" className={thClass}>#</th>
                  <th scope="col" className={thClass}>Stage</th>
                  <th scope="col" className={`${thClass} text-right`}>Fee %</th>
                  <th scope="col" className={thClass}>Planned start</th>
                  <th scope="col" className={thClass}>Planned end</th>
                  <th scope="col" className={thClass}>Senior QC</th>
                  <th scope="col" className={thClass}>State</th>
                  <th scope="col" className={thClass}>Actual</th>
                  <th scope="col" className={thClass}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id ?? `new-${i}`}>
                    <td className={`${tdClass} tabular`}>{i + 1}</td>
                    <td className={tdClass}>
                      {canEdit ? <TextInput aria-label={`Stage ${i + 1} name`} value={r.name} onChange={(e) => update(i, { name: e.target.value })} /> : r.name}
                    </td>
                    <td className={`${tdClass} text-right`}>
                      {canEdit ? (
                        <TextInput aria-label={`${r.name || `Stage ${i + 1}`} fee %`} type="number" min={0} max={100} step={0.01} className="w-24 text-right tabular" value={r.fee_pct} onChange={(e) => update(i, { fee_pct: e.target.value })} />
                      ) : (
                        `${r.fee_pct}%`
                      )}
                    </td>
                    <td className={tdClass}>
                      {canEdit ? <TextInput aria-label={`${r.name} planned start`} type="date" value={r.planned_start} onChange={(e) => update(i, { planned_start: e.target.value })} /> : formatDate(r.planned_start)}
                    </td>
                    <td className={tdClass}>
                      {canEdit ? <TextInput aria-label={`${r.name} planned end`} type="date" value={r.planned_end} onChange={(e) => update(i, { planned_end: e.target.value })} /> : formatDate(r.planned_end)}
                    </td>
                    <td className={tdClass}>
                      <input type="checkbox" aria-label={`${r.name} needs senior QC`} disabled={!canEdit} checked={r.requires_senior_qc} onChange={(e) => update(i, { requires_senior_qc: e.target.checked })} />
                    </td>
                    <td className={tdClass}>{r.state ? <StageChip state={r.state} /> : <span className="text-small text-muted">New</span>}</td>
                    <td className={`${tdClass} text-small whitespace-nowrap`}>
                      {r.actual_start ? `${formatDate(r.actual_start)} → ${r.actual_end ? formatDate(r.actual_end) : "…"}` : "—"}
                    </td>
                    <td className={`${tdClass} whitespace-nowrap text-right`}>
                      {canEdit && r.id && !dirty &&
                        r.allowed_actions?.map((a) => (
                          <Button key={a.action} size="sm" variant="ghost" busy={act.isPending && act.variables?.action === a.action && act.variables?.id === r.id} onClick={() => act.mutate({ id: r.id!, action: a.action })}>
                            {a.label}
                          </Button>
                        ))}
                      {project.my_permissions.record_approval && r.id && !dirty && (r.state === "active" || r.state === "deliverables_issued") && (
                        <RecordApprovalButton stageId={r.id} stageName={r.name} />
                      )}
                      {canEdit && !r.sheet_count && (
                        <Button size="sm" variant="ghost" aria-label={`Remove ${r.name || "stage"}`} onClick={() => setRows((l) => l.filter((_, j) => j !== i))}>
                          <Trash2 size={14} aria-hidden="true" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" colSpan={2} className="px-3 py-2 text-right text-small text-muted">Fee total</th>
                  <td className={`px-3 py-2 text-right font-semibold tabular ${totalOk ? "" : "text-danger"}`}>{total.toFixed(2)}%</td>
                  <td colSpan={6} className="px-3 py-2 text-small text-muted">{totalOk ? "Totals 100%." : "Must total 100% to save as final."}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {canEdit && rows.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border p-4">
            <Button variant="primary" busy={save.isPending && save.variables === true} disabled={!totalOk || rows.some((r) => !r.name)} onClick={() => save.mutate(true)}>
              Save as final
            </Button>
            <Button busy={save.isPending && save.variables === false} disabled={rows.some((r) => !r.name)} onClick={() => save.mutate(false)}>
              Save draft
            </Button>
            <span className="text-small text-muted">{project.stage_plan_final ? "Current plan is final." : "Current plan is a draft."}</span>
          </div>
        )}
      </Card>
      <AppointmentLetter />
      <ConfirmDialog
        open={confirmTemplate !== null}
        onOpenChange={(o) => !o && setConfirmTemplate(null)}
        title="Replace the stage plan with the template?"
        confirmLabel="Apply template"
        busy={apply.isPending}
        onConfirm={() => confirmTemplate && apply.mutate(confirmTemplate)}
      >
        The current stages are replaced by the template's stages. Stages that already have sheets cannot be replaced.
      </ConfirmDialog>
    </div>
  );
}

function AppointmentLetter() {
  const { project } = useProjectContext();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canEdit = !!project.my_permissions.edit_project;

  const open = async () => {
    const link = await unwrap(api.GET("/api/v1/projects/{project_pk}/appointment-letter", { params: { path: { project_pk: project.id } } }));
    window.open(link.url, "_blank", "noopener");
  };
  const upload = async (file: File) => {
    setBusy(true);
    setError("");
    try {
      const done = await uploadFile(file, "document");
      await unwrap(api.POST("/api/v1/projects/{project_pk}/appointment-letter", { params: { path: { project_pk: project.id } }, body: { upload_id: done.id } }));
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(project.id) });
      toast({ title: "Appointment letter attached" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Appointment letter">
      <div className="flex flex-wrap items-center gap-3 p-4">
        {project.appointment_letter ? (
          <Button icon={<FileText size={16} aria-hidden="true" />} onClick={open}>Open appointment letter</Button>
        ) : (
          <p className="text-body text-muted">No appointment letter attached.</p>
        )}
        {canEdit && (
          <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-sm border border-border bg-surface px-3 font-semibold hover:bg-surface-muted">
            <Upload size={16} aria-hidden="true" />
            {busy ? "Uploading…" : project.appointment_letter ? "Replace PDF" : "Attach PDF"}
            <input type="file" accept="application/pdf" className="sr-only" disabled={busy} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </label>
        )}
        {error && <p role="alert" className="text-small text-danger">{error}</p>}
      </div>
    </Card>
  );
}

