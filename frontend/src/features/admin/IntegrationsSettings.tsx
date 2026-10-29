import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, KeyRound, Mail } from "lucide-react";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog, Drawer } from "@/components/ui/Dialog";
import { Field, TextInput } from "@/components/ui/Field";
import { Card, PageHeader, tableClass, tdClass, thClass } from "@/components/ui/PageHeader";
import { DataState, EmptyState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";

import { AccountingIntegration } from "./AccountingIntegration";
import { api, ApiError, type Schemas, unwrap } from "@/lib/api/client";
import { allauth } from "@/lib/auth/allauth";
import type { Me } from "@/lib/auth/useMe";
import { formatDate } from "@/lib/format";

type Token = Schemas["ApiToken"];
const SCOPES = [
  { value: "cad_sync:write", label: "CAD sync (Revit / AutoCAD plugins)" },
  { value: "accounting:read", label: "Accounting export (read)" },
  { value: "accounting:write", label: "Accounting (mark invoiced)" },
] as const;

/** S-14 Integrations: SSO status, outbound email check, API tokens for plugins (02 §11). */
export function IntegrationsSettings({ me }: { me: Me }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const config = useQuery({ queryKey: ["allauth-config"], queryFn: allauth.config, staleTime: Infinity });
  const tokens = useQuery({ queryKey: ["api-tokens"], queryFn: () => unwrap(api.GET("/api/v1/api-tokens")) });
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<Token | null>(null);

  const testEmail = useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/org/test-email")),
    onSuccess: () => toast({ title: "Test email queued", description: `Check ${me.email} in a minute.` }),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => unwrap(api.POST("/api/v1/api-tokens/{id}/revoke", { params: { path: { id } } })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-tokens"] });
      toast({ title: `Token “${revoking?.name}” revoked` });
      setRevoking(null);
    },
  });
  const providers = config.data?.data?.socialaccount?.providers ?? [];
  const rows = tokens.data?.results ?? [];

  return (
    <>
      <PageHeader title="Integrations" />
      <div className="flex flex-col gap-4">
        <Card title="Single sign-on">
          <p className="p-4 text-body">
            {providers.length
              ? `Staff sign in with ${providers.map((p) => p.name).join(" and ")}.`
              : "No single sign-on provider is configured yet (DEC-02). Ask IT to add the Google Workspace or Microsoft 365 client ID to the server settings."}
          </p>
        </Card>
        <Card title="Outbound email">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-body">Send yourself a test email to check the mail relay.</p>
            <Button icon={<Mail size={16} aria-hidden="true" />} busy={testEmail.isPending} onClick={() => testEmail.mutate()}>
              Send test email
            </Button>
          </div>
        </Card>
        <Card
          title="API tokens"
          actions={
            <Button size="sm" variant="primary" icon={<KeyRound size={14} aria-hidden="true" />} onClick={() => setCreating(true)}>
              Create token
            </Button>
          }
        >
          <DataState
            isPending={tokens.isPending}
            error={tokens.error}
            isEmpty={rows.length === 0}
            onRetry={() => tokens.refetch()}
            empty={<EmptyState message="No API tokens. CAD plugins and the accounting tool need one." />}
          >
            <table className={tableClass}>
              <thead>
                <tr>
                  <th scope="col" className={thClass}>Name</th>
                  <th scope="col" className={thClass}>Token</th>
                  <th scope="col" className={thClass}>Acts as</th>
                  <th scope="col" className={thClass}>Scopes</th>
                  <th scope="col" className={thClass}>Expires</th>
                  <th scope="col" className={thClass}>Last used</th>
                  <th scope="col" className={thClass}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id} className={t.is_usable ? undefined : "text-muted"}>
                    <td className={tdClass}>{t.name}</td>
                    <td className={tdClass}><span className="mono text-small">dop_{t.key_id}_…</span></td>
                    <td className={tdClass}>{t.user_email}</td>
                    <td className={tdClass}>{t.scopes.join(", ")}</td>
                    <td className={tdClass}>{t.revoked_at ? `Revoked ${formatDate(t.revoked_at)}` : formatDate(t.expires_at)}</td>
                    <td className={tdClass}>{t.last_used_at ? formatDate(t.last_used_at) : "Never"}</td>
                    <td className={`${tdClass} text-right`}>
                      {t.is_usable && (
                        <Button size="sm" variant="danger" onClick={() => setRevoking(t)}>Revoke</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataState>
        </Card>
        <AccountingIntegration />
      </div>
      <Drawer open={creating} onOpenChange={setCreating} title="Create API token">
        {creating && <TokenForm me={me} onDone={() => setCreating(false)} />}
      </Drawer>
      <ConfirmDialog
        open={revoking !== null}
        onOpenChange={(o) => !o && setRevoking(null)}
        title={`Revoke “${revoking?.name}”?`}
        confirmLabel="Revoke token"
        destructive
        busy={revoke.isPending}
        onConfirm={() => revoking && revoke.mutate(revoking.id)}
      >
        Anything using this token stops working immediately. This cannot be undone; create a new token if needed.
      </ConfirmDialog>
    </>
  );
}

function TokenForm({ me, onDone }: { me: Me; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["cad_sync:write"]);
  const [days, setDays] = useState("90");
  const [created, setCreated] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST("/api/v1/api-tokens", {
          body: { name, user: me.id, scopes: scopes as Schemas["ApiTokenCreateRequest"]["scopes"], expires_in_days: Number(days) },
        }),
      ),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["api-tokens"] });
      setCreated(data.token);
    },
  });
  const error = create.error instanceof ApiError ? create.error : null;

  if (created) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-body">Copy this token now. It is shown only once and stored only as a hash.</p>
        <div className="flex items-center gap-2 rounded-sm bg-surface-muted p-3">
          <code className="flex-1 overflow-x-auto text-small">{created}</code>
          <button type="button" aria-label="Copy token" className="rounded-sm p-1 hover:bg-surface" onClick={() => navigator.clipboard?.writeText(created)}>
            <Copy size={16} aria-hidden="true" />
          </button>
        </div>
        <Button variant="primary" onClick={onDone}>Done</Button>
      </div>
    );
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate();
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {error && <p role="alert" className="text-small text-danger">{error.message}</p>}
      <Field label="Name" hint="Where it is used, e.g. “Revit add-in, studio PCs”." error={error?.field("name")}>
        {(a) => <TextInput {...a} required value={name} onChange={(e) => setName(e.target.value)} />}
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-small font-semibold text-muted">Scopes</legend>
        {SCOPES.map((s) => (
          <label key={s.value} className="flex items-center gap-2 text-body">
            <input
              type="checkbox"
              checked={scopes.includes(s.value)}
              onChange={(e) => setScopes((list) => (e.target.checked ? [...list, s.value] : list.filter((v) => v !== s.value)))}
            />
            {s.label}
          </label>
        ))}
      </fieldset>
      <Field label="Expires after (days)" error={error?.field("expires_in_days")}>
        {(a) => <TextInput {...a} type="number" min={1} max={365} value={days} onChange={(e) => setDays(e.target.value)} />}
      </Field>
      <Button type="submit" variant="primary" busy={create.isPending} disabled={!name || scopes.length === 0}>
        Create token
      </Button>
    </form>
  );
}
