import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Smartphone } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card, tableClass, tdClass, thClass } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { useProjectContext } from "@/features/projects/ProjectLayout";
import { api, unwrap } from "@/lib/api/client";
import { formatDate, formatDateTime } from "@/lib/format";

/** F-51: magic links to the phone-friendly current issued set for site people (S-18). */
export function SiteLinks() {
  const { project } = useProjectContext();
  const queryClient = useQueryClient();
  const toast = useToast();
  const key = ["projects", project.id, "site-links"];
  const links = useQuery({ queryKey: key, queryFn: () => unwrap(api.GET("/api/v1/projects/{project_pk}/site-links", { params: { path: { project_pk: project.id } } })) });
  const contacts = useQuery({ queryKey: ["contacts", "all"], queryFn: () => unwrap(api.GET("/api/v1/contacts", { params: { query: { page_size: 200 } } })) });
  const [contact, setContact] = useState("");
  const create = useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/projects/{project_pk}/site-links", { params: { path: { project_pk: project.id } }, body: { contact } })),
    onSuccess: (l) => {
      queryClient.invalidateQueries({ queryKey: key });
      toast({ title: `Site link emailed to ${l.contact_name}` });
      setContact("");
    },
    onError: (e) => toast({ title: "Not sent", description: e.message }),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => unwrap(api.POST("/api/v1/site-links/{id}/revoke", { params: { path: { id } } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });
  const people = (contacts.data?.results ?? []).filter((c) => c.email);
  const rows = links.data ?? [];
  return (
    <Card title="Site view links">
      <div className="flex flex-col gap-3 p-4">
        <p className="text-small text-muted">Send a site engineer or contractor a link to the current issued drawings. It opens on a phone without signing in and never shows superseded revisions.</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-small font-semibold text-muted">
            Contact
            <select className="h-9 min-w-64 rounded-sm border border-border bg-surface px-2 text-body text-text" value={contact} onChange={(e) => setContact(e.target.value)}>
              <option value="">Choose…</option>
              {people.map((c) => <option key={c.id} value={c.id}>{c.full_name} · {c.email}</option>)}
            </select>
          </label>
          <Button variant="primary" icon={<Smartphone size={14} aria-hidden="true" />} disabled={!contact} busy={create.isPending} onClick={() => create.mutate()}>Email site link</Button>
        </div>
        {rows.length > 0 && (
          <table className={tableClass}>
            <thead>
              <tr>
                <th scope="col" className={thClass}>Contact</th>
                <th scope="col" className={thClass}>Valid until</th>
                <th scope="col" className={thClass}>Last opened</th>
                <th scope="col" className={`${thClass} text-right`}>Downloads</th>
                <th scope="col" className={thClass}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id}>
                  <td className={tdClass}>{l.contact_name}</td>
                  <td className={tdClass}>{l.revoked_at ? `Revoked ${formatDate(l.revoked_at)}` : formatDate(l.expires_at)}</td>
                  <td className={tdClass}>{l.last_used_at ? formatDateTime(l.last_used_at) : "Not yet"}</td>
                  <td className={`${tdClass} text-right tabular`}>{l.downloads}</td>
                  <td className={`${tdClass} text-right`}>{!l.revoked_at && <Button size="sm" variant="ghost" onClick={() => revoke.mutate(l.id)}>Revoke</Button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}
