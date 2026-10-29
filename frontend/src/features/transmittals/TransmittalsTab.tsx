import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Send } from "lucide-react";
import { Link, useParams } from "react-router";

import { Button } from "@/components/ui/Button";
import { Card, tableClass, tdClass, thClass } from "@/components/ui/PageHeader";
import { DataState, EmptyState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { api, unwrap } from "@/lib/api/client";
import { formatDate, formatDateTime } from "@/lib/format";
import { ExportButton } from "@/features/exports/ExportButton";
import { useProjectContext } from "@/features/projects/ProjectLayout";

import { SiteLinks } from "./SiteLinks";

/** Transmittal log per project (03 §8 reports). */
export function TransmittalsTab() {
  const { project } = useProjectContext();
  return (
    <div className="flex flex-col gap-4">
      <TransmittalList />
      {project.my_permissions.issue && <SiteLinks />}
    </div>
  );
}

function TransmittalList() {
  const { project } = useProjectContext();
  const list = useQuery({
    queryKey: ["transmittals", project.id],
    queryFn: () => unwrap(api.GET("/api/v1/projects/{project_pk}/transmittals", { params: { path: { project_pk: project.id } } })),
  });
  const rows = list.data ?? [];
  return (
    <Card
      title="Transmittals"
      actions={
        <div className="flex items-center gap-2">
          <ExportButton kind="transmittal_log" projectId={project.id} />
          {project.my_permissions.issue && (
            <Link to="../issue" className="inline-flex h-8 items-center gap-1.5 rounded-sm bg-primary px-3 text-small font-semibold text-on-primary">
              <Send size={14} aria-hidden="true" /> Issue drawings
            </Link>
          )}
        </div>
      }
    >
      <DataState isPending={list.isPending} error={list.error} isEmpty={rows.length === 0} onRetry={() => list.refetch()} empty={<EmptyState message="Nothing has been issued on this project yet." />}>
        <table className={tableClass}>
          <thead>
            <tr>
              <th scope="col" className={thClass}>Number</th>
              <th scope="col" className={thClass}>Sent</th>
              <th scope="col" className={thClass}>Purpose</th>
              <th scope="col" className={`${thClass} text-right`}>Sheets</th>
              <th scope="col" className={`${thClass} text-right`}>Recipients</th>
              <th scope="col" className={thClass}>By</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className="hover:bg-surface-muted">
                <td className={tdClass}><Link to={t.id} className="mono font-semibold text-primary hover:underline">{t.number}</Link>{t.supersedes_number && <span className="ml-2 text-small text-muted">corrects {t.supersedes_number}</span>}</td>
                <td className={tdClass}>{formatDate(t.sent_at)}</td>
                <td className={tdClass}>{t.purpose_label}</td>
                <td className={`${tdClass} text-right tabular`}>{t.sheet_count}</td>
                <td className={`${tdClass} text-right tabular`}>{t.recipient_count}</td>
                <td className={tdClass}>{t.sent_by.short_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataState>
    </Card>
  );
}

export function TransmittalDetail() {
  const { transmittalId = "" } = useParams();
  const { project } = useProjectContext();
  const queryClient = useQueryClient();
  const toast = useToast();
  const query = useQuery({
    queryKey: ["transmittal", transmittalId],
    queryFn: () => unwrap(api.GET("/api/v1/transmittals/{id}", { params: { path: { id: transmittalId } } })),
    refetchInterval: (q) => (q.state.data && !q.state.data.has_cover ? 2000 : 30_000),
  });
  const resend = useMutation({
    mutationFn: (id: string) => unwrap(api.POST("/api/v1/recipients/{id}/resend", { params: { path: { id } } })),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["transmittal", transmittalId] });
      toast({ title: `New link sent to ${r.contact_name}` });
    },
  });
  const openCover = async () => {
    const link = (await unwrap(api.GET("/api/v1/transmittals/{id}/cover", { params: { path: { id: transmittalId } } }))) as unknown as { url: string };
    window.open(link.url, "_blank", "noopener");
  };
  const t = query.data;
  return (
    <DataState isPending={query.isPending} error={query.error} isEmpty={false} empty={null} onRetry={() => query.refetch()}>
      {t && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-title font-semibold"><span className="mono">{t.number}</span> · {t.purpose_label}</h2>
              <p className="text-small text-muted">Sent {formatDateTime(t.sent_at)} by {t.sent_by.full_name}{t.supersedes_number ? ` · corrects ${t.supersedes_number}` : ""}</p>
              {t.override_reason && <p className="text-small" style={{ color: "var(--flag-at_risk-fg)" }}>Issued by PL override: {t.override_reason}</p>}
            </div>
            <Button icon={<FileText size={16} aria-hidden="true" />} disabled={!t.has_cover} onClick={openCover}>{t.has_cover ? "Cover sheet" : "Making cover sheet…"}</Button>
          </div>
          {t.note && <p className="rounded-md border border-border bg-surface p-3 text-body whitespace-pre-wrap">{t.note}</p>}
          <Card title={`Sheets (${t.items.length})`}>
            <table className={tableClass}>
              <thead><tr><th scope="col" className={thClass}>Sheet</th><th scope="col" className={thClass}>Title</th><th scope="col" className={thClass}>Revision</th></tr></thead>
              <tbody>
                {t.items.map((i) => (
                  <tr key={i.revision_id}>
                    <td className={tdClass}><Link to={`/projects/${project.id}/sheets/${i.sheet_id}`} className="mono text-primary hover:underline">{i.number}</Link></td>
                    <td className={tdClass}>{i.title}</td>
                    <td className={tdClass}><span className={`mono ${i.revision_state === "superseded" ? "line-through" : ""}`}>{i.revision}</span>{i.revision_state === "superseded" && <span className="ml-2 text-small text-muted">superseded</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card title={`Recipients (${t.recipients.length})`}>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th scope="col" className={thClass}>Recipient</th>
                  <th scope="col" className={thClass}>Delivery</th>
                  <th scope="col" className={thClass}>Downloaded</th>
                  <th scope="col" className={thClass}>Acknowledged</th>
                  <th scope="col" className={thClass}>Link valid until</th>
                  <th scope="col" className={thClass}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {t.recipients.map((r) => (
                  <tr key={r.id}>
                    <td className={tdClass}>{r.contact_name}<span className="ml-2 text-small text-muted">{r.organisation}</span></td>
                    <td className={tdClass}>
                      {r.delivery === "hand" ? `By hand ${formatDate(r.delivered_at)}` : r.bounced_at ? <span style={{ color: "var(--flag-late-fg)" }}>Bounced: {r.bounce_reason || "undeliverable"}</span> : r.delivered_at ? `Emailed ${formatDateTime(r.delivered_at)}` : "Sending…"}
                    </td>
                    <td className={tdClass}>{r.last_downloaded_at ? formatDateTime(r.last_downloaded_at) : "Not yet"}</td>
                    <td className={tdClass}>{r.acknowledged_at ? `✓ ${formatDateTime(r.acknowledged_at)}` : r.delivery === "hand" ? "—" : "Not yet"}</td>
                    <td className={tdClass}>{r.link_expires_at ? formatDate(r.link_expires_at) : "—"}</td>
                    <td className={`${tdClass} text-right`}>
                      {project.my_permissions.issue && r.delivery === "email" && (
                        <Button size="sm" variant={r.bounced_at ? "primary" : "ghost"} busy={resend.isPending && resend.variables === r.id} onClick={() => resend.mutate(r.id)}>Resend</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </DataState>
  );
}
