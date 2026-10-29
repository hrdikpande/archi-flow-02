import { Plus, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Field, Select, TextInput } from "@/components/ui/Field";
import { Card, PageHeader, tableClass, tdClass, thClass } from "@/components/ui/PageHeader";
import { DataState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { ApiError, type Schemas } from "@/lib/api/client";
import { formatDateTime } from "@/lib/format";

import { useOrgSettings, useSaveOrgSettings } from "./useOrgSettings";

type Settings = Schemas["OrgSettings"];
type Code = Schemas["CodeLabel"];

const TIMEZONES = ["Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Europe/London", "UTC"];

/** S-14 Organisation (F-42): name, timezone, formats, purpose codes, revision scheme. */
export function OrganisationSettings() {
  const query = useOrgSettings();
  return (
    <>
      <PageHeader title="Organisation" meta={query.data ? `Last changed ${formatDateTime(query.data.updated_at)}` : undefined} />
      <DataState isPending={query.isPending} error={query.error} isEmpty={false} empty={null} onRetry={() => query.refetch()}>
        {query.data && <SettingsForm key={query.data.updated_at} initial={query.data} />}
      </DataState>
    </>
  );
}

function SettingsForm({ initial }: { initial: Settings }) {
  const save = useSaveOrgSettings();
  const toast = useToast();
  const [name, setName] = useState(initial.organisation?.name ?? "");
  const [timezone, setTimezone] = useState(initial.organisation?.timezone ?? "Asia/Kolkata");
  const [digest, setDigest] = useState(initial.digest_time?.slice(0, 5) ?? "08:30");
  const [linkDays, setLinkDays] = useState(String(initial.transmittal_link_days ?? 30));
  const [capacity, setCapacity] = useState(String(initial.default_weekly_capacity_h ?? "45"));
  const [ackDays, setAckDays] = useState(String(initial.acknowledge_within_days ?? 5));
  const [codeFormat, setCodeFormat] = useState(initial.project_code_format ?? "YYYY-NNN");
  const [purposes, setPurposes] = useState<Code[]>(initial.purpose_codes ?? []);
  const error = save.error instanceof ApiError ? save.error : null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate(
      {
        organisation: { name, timezone },
        digest_time: digest,
        transmittal_link_days: Number(linkDays),
        default_weekly_capacity_h: capacity,
        acknowledge_within_days: Number(ackDays),
        project_code_format: codeFormat,
        purpose_codes: purposes.map((p) => ({ code: p.code, label: p.label, active: p.active ?? true })),
      },
      { onSuccess: () => toast({ title: "Settings saved", description: "Changes apply to new records." }) },
    );
  };

  const updatePurpose = (index: number, patch: Partial<Code>) =>
    setPurposes((list) => list.map((p, i) => (i === index ? { ...p, ...patch } : p)));

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {error && (
        <p role="alert" className="rounded-sm bg-danger-bg px-3 py-2 text-small text-danger">
          {error.message}
        </p>
      )}
      <Card title="Firm">
        <div className="grid gap-4 p-4 md:grid-cols-2">
          <Field label="Firm name">{(a) => <TextInput {...a} required value={name} onChange={(e) => setName(e.target.value)} />}</Field>
          <Field label="Timezone" hint="Dates and times show in this timezone.">
            {(a) => (
              <Select {...a} value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Project code format" hint="Default YYYY-NNN, for example 2026-014.">
            {(a) => <TextInput {...a} value={codeFormat} onChange={(e) => setCodeFormat(e.target.value)} />}
          </Field>
          <Field label="Daily digest time" hint="Local time the daily email digest is sent.">
            {(a) => <TextInput {...a} type="time" value={digest} onChange={(e) => setDigest(e.target.value)} />}
          </Field>
          <Field label="Transmittal link valid for (days)" error={error?.field("transmittal_link_days")}>
            {(a) => <TextInput {...a} type="number" min={1} max={365} value={linkDays} onChange={(e) => setLinkDays(e.target.value)} />}
          </Field>
          <Field label="Flag unacknowledged transmittals after (days)" error={error?.field("acknowledge_within_days")}>
            {(a) => <TextInput {...a} type="number" min={1} max={60} value={ackDays} onChange={(e) => setAckDays(e.target.value)} />}
          </Field>
          <Field label="Default weekly capacity (hours)" error={error?.field("default_weekly_capacity_h")}>
            {(a) => <TextInput {...a} type="number" min={1} max={80} step={0.5} value={capacity} onChange={(e) => setCapacity(e.target.value)} />}
          </Field>
        </div>
      </Card>

      <Card
        title="Purpose codes"
        actions={
          <Button size="sm" icon={<Plus size={14} aria-hidden="true" />} onClick={() => setPurposes((l) => [...l, { code: "", label: "", active: true }])}>
            Add purpose
          </Button>
        }
      >
        <p className="px-4 pt-3 text-small text-muted">
          Required when issuing (F-08). Never use the bare acronym IFC: write GFC or “Issued for Construction”.
        </p>
        {error?.errors.purpose_codes && (
          <p role="alert" className="px-4 pt-2 text-small text-danger">
            {JSON.stringify(error.errors.purpose_codes)}
          </p>
        )}
        <table className={tableClass}>
          <thead>
            <tr>
              <th scope="col" className={thClass}>Code</th>
              <th scope="col" className={thClass}>Label</th>
              <th scope="col" className={thClass}>In use</th>
              <th scope="col" className={thClass}><span className="sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody>
            {purposes.map((p, i) => (
              <tr key={i}>
                <td className={tdClass}>
                  <TextInput aria-label={`Code ${i + 1}`} className="mono w-24 uppercase" value={p.code} onChange={(e) => updatePurpose(i, { code: e.target.value.toUpperCase() })} />
                </td>
                <td className={tdClass}>
                  <TextInput aria-label={`Label ${i + 1}`} value={p.label} onChange={(e) => updatePurpose(i, { label: e.target.value })} />
                </td>
                <td className={tdClass}>
                  <input type="checkbox" aria-label={`${p.label || "Purpose"} in use`} checked={p.active ?? true} onChange={(e) => updatePurpose(i, { active: e.target.checked })} />
                </td>
                <td className={tdClass}>
                  <Button size="sm" variant="ghost" aria-label={`Remove ${p.label || "purpose"}`} onClick={() => setPurposes((l) => l.filter((_, j) => j !== i))}>
                    <Trash2 size={14} aria-hidden="true" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Revision codes">
        <p className="p-4 text-body">
          {(initial.revision_scheme?.series ?? []).map((s) => `${s.prefix} = ${s.label}`).join(" · ")} · {initial.revision_scheme?.digits} digits, for
          example <span className="mono">{initial.revision_scheme?.series?.[0]?.prefix}{"1".padStart(initial.revision_scheme?.digits ?? 2, "0")}</span>.
          The scheme is confirmed in discovery (DEC-06).
        </p>
      </Card>

      <div>
        <Button type="submit" variant="primary" busy={save.isPending}>
          Save settings
        </Button>
      </div>
    </form>
  );
}
