import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Field, Select, TextInput } from "@/components/ui/Field";
import { Card } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { ApiError, type Schemas } from "@/lib/api/client";

import { useOrgSettings, useSaveOrgSettings } from "./useOrgSettings";

const FIELDS: Record<string, string> = {
  project_code: "Project code",
  project_name: "Project name",
  client: "Client",
  stage: "Stage",
  fee_pct: "Fee %",
  fee_amount: "Fee amount (INR)",
  ready_date: "Ready since",
  days_waiting: "Days waiting",
  approved_by: "Client approval by",
  approved_on: "Approved on",
};

type Column = { field: string; header: string };

/** I-08 / F-28: the ready-to-invoice CSV in the layout agreed with the firm, and a webhook. */
export function AccountingIntegration() {
  const settings = useOrgSettings();
  if (!settings.data) return null;
  return <AccountingForm key={settings.dataUpdatedAt} initial={settings.data} />;
}

function AccountingForm({ initial }: { initial: Schemas["OrgSettings"] }) {
  const save = useSaveOrgSettings();
  const toast = useToast();
  const [columns, setColumns] = useState<Column[]>((initial.billing_csv_columns as Column[] | undefined) ?? []);
  const [url, setUrl] = useState(initial.billing_webhook_url ?? "");
  const [secret, setSecret] = useState("");
  const error = save.error instanceof ApiError ? save.error : null;
  const move = (i: number, by: number) => {
    const next = [...columns];
    const [c] = next.splice(i, 1);
    next.splice(i + by, 0, c!);
    setColumns(next);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(
      { billing_csv_columns: columns, billing_webhook_url: url, ...(secret ? { billing_webhook_secret: secret } : {}) },
      { onSuccess: () => toast({ title: "Accounting export saved" }) },
    );
  };
  return (
    <Card title="Accounting export (billing signal)">
      <form className="flex flex-col gap-4 p-4" onSubmit={submit}>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-body font-semibold">CSV columns, in order</legend>
          {columns.map((c, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <Select aria-label={`Column ${i + 1} field`} className="w-52" value={c.field} onChange={(e) => setColumns(columns.map((x, j) => (j === i ? { ...x, field: e.target.value } : x)))}>
                {Object.entries(FIELDS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
              <TextInput aria-label={`Column ${i + 1} heading`} className="w-56" value={c.header} maxLength={60} onChange={(e) => setColumns(columns.map((x, j) => (j === i ? { ...x, header: e.target.value } : x)))} />
              <Button size="sm" variant="ghost" aria-label={`Move column ${i + 1} up`} disabled={i === 0} icon={<ArrowUp size={14} aria-hidden="true" />} onClick={() => move(i, -1)} />
              <Button size="sm" variant="ghost" aria-label={`Move column ${i + 1} down`} disabled={i === columns.length - 1} icon={<ArrowDown size={14} aria-hidden="true" />} onClick={() => move(i, 1)} />
              <Button size="sm" variant="ghost" aria-label={`Remove column ${i + 1}`} icon={<Trash2 size={14} aria-hidden="true" />} onClick={() => setColumns(columns.filter((_, j) => j !== i))} />
            </div>
          ))}
          <Button size="sm" className="w-fit" icon={<Plus size={14} aria-hidden="true" />} onClick={() => setColumns([...columns, { field: "project_code", header: "Project code" }])}>Add column</Button>
          {error?.field("billing_csv_columns") && <p role="alert" className="text-small text-danger">{error.field("billing_csv_columns")}</p>}
        </fieldset>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Webhook URL (optional)" hint="Each stage that becomes ready to invoice is POSTed as JSON." error={error?.field("billing_webhook_url")}>
            {(p) => <TextInput {...p} type="url" value={url} placeholder="https://accounts.example/drawingops" onChange={(e) => setUrl(e.target.value)} />}
          </Field>
          <Field label="Webhook secret" hint="Signs each request: X-DrawingOps-Signature: sha256=HMAC(secret, body). Leave blank to keep the current one.">
            {(p) => <TextInput {...p} type="password" autoComplete="new-password" value={secret} onChange={(e) => setSecret(e.target.value)} />}
          </Field>
        </div>
        <p className="text-small text-muted">To mark stages invoiced from the accounting tool, create an API token above with the “Accounting (mark invoiced)” scope.</p>
        <div className="flex justify-end">
          <Button type="submit" variant="primary" busy={save.isPending}>Save</Button>
        </div>
      </form>
    </Card>
  );
}
