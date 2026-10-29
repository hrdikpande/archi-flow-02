import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { Card, PageHeader, tableClass, tdClass, thClass } from "@/components/ui/PageHeader";
import { DataState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { api, unwrap } from "@/lib/api/client";

const MODES = [
  { value: "instant", label: "Instant" },
  { value: "digest", label: "Daily digest" },
  { value: "off", label: "Off" },
] as const;

/** S-13 preferences: events × Instant / Digest / Off; mandatory events locked (F-21). */
export function PreferencesPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const prefs = useQuery({ queryKey: ["notification-preferences"], queryFn: () => unwrap(api.GET("/api/v1/notification-preferences")) });
  const [quietFrom, setQuietFrom] = useState<string | null>(null);
  const [quietTo, setQuietTo] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (body: { modes?: Record<string, "instant" | "digest" | "off">; quiet_from?: string | null; quiet_to?: string | null }) =>
      unwrap(api.PUT("/api/v1/notification-preferences", { body })),
    onSuccess: (data) => {
      queryClient.setQueryData(["notification-preferences"], data);
      toast({ title: "Preferences saved" });
    },
    onError: (e) => toast({ title: "Not saved", description: e.message }),
  });
  const events = (prefs.data?.events ?? []).filter((e) => e.phase === "P1" || e.phase === "P2" || e.phase === "P3");
  const from = quietFrom ?? prefs.data?.quiet_from?.slice(0, 5) ?? "";
  const to = quietTo ?? prefs.data?.quiet_to?.slice(0, 5) ?? "";

  return (
    <>
      <PageHeader title="Notification preferences" meta="Choose how each kind of update reaches you. Everything also appears in the bell." />
      <DataState isPending={prefs.isPending} error={prefs.error} isEmpty={false} empty={null} onRetry={() => prefs.refetch()}>
        <div className="flex flex-col gap-4">
          <Card>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th scope="col" className={thClass}>Update</th>
                  {MODES.map((m) => <th key={m.value} scope="col" className={`${thClass} text-center`}>{m.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.event}>
                    <th scope="row" className={`${tdClass} text-left font-normal`}>
                      {e.label}
                      {e.mandatory && (
                        <span className="ml-2 inline-flex items-center gap-1 text-small text-muted">
                          <Lock size={12} aria-hidden="true" /> Required: you need this to do your work
                        </span>
                      )}
                    </th>
                    {MODES.map((m) => (
                      <td key={m.value} className={`${tdClass} text-center`}>
                        <input
                          type="radio"
                          name={e.event}
                          aria-label={`${e.label}: ${m.label}`}
                          checked={e.mode === m.value}
                          disabled={e.mandatory || save.isPending}
                          onChange={() => save.mutate({ modes: { [e.event]: m.value } })}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card title="Quiet hours">
            <div className="flex flex-wrap items-end gap-3 p-4">
              <Field label="From">{(a) => <TextInput {...a} type="time" value={from} onChange={(ev) => setQuietFrom(ev.target.value)} />}</Field>
              <Field label="To">{(a) => <TextInput {...a} type="time" value={to} onChange={(ev) => setQuietTo(ev.target.value)} />}</Field>
              <Button busy={save.isPending} onClick={() => save.mutate({ quiet_from: from || null, quiet_to: to || null })}>Save quiet hours</Button>
              <p className="w-full text-small text-muted">Instant emails during quiet hours wait for your next daily digest.</p>
            </div>
          </Card>
        </div>
      </DataState>
    </>
  );
}
