import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Field, Select, TextInput } from "@/components/ui/Field";
import { Card, PageHeader, tableClass, tdClass, thClass } from "@/components/ui/PageHeader";
import { DataState, EmptyState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, unwrap } from "@/lib/api/client";
import { formatDate, todayISO } from "@/lib/format";

import { useOrgSettings, useSaveOrgSettings } from "./useOrgSettings";

const WEEKDAY = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" });

/** S-14 Working calendar (F-42, DEC-04): drives "working days" in every automation. */
export function CalendarSettings() {
  const settings = useOrgSettings();
  const saveSettings = useSaveOrgSettings();
  const queryClient = useQueryClient();
  const toast = useToast();
  const thisYear = Number(todayISO().slice(0, 4));
  const [year, setYear] = useState(thisYear);
  const [date, setDate] = useState("");
  const [name, setName] = useState("");

  const holidays = useQuery({
    queryKey: ["holidays", year],
    queryFn: () => unwrap(api.GET("/api/v1/holidays", { params: { query: { year } } })),
  });
  const add = useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/holidays", { body: { date, name } })),
    onSuccess: (h) => {
      queryClient.invalidateQueries({ queryKey: ["holidays"] });
      toast({ title: `${h.name} added`, description: formatDate(h.date) });
      setDate("");
      setName("");
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE("/api/v1/holidays/{id}", { params: { path: { id } } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["holidays"] }),
  });
  const addError = add.error instanceof ApiError ? add.error : null;
  // Selection updates instantly; the server confirms or we roll back (DESIGN.md §6).
  const [selectedWeek, setSelectedWeek] = useState<string | undefined>();
  const workWeek = selectedWeek ?? settings.data?.organisation?.work_week;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    add.mutate();
  };

  return (
    <>
      <PageHeader title="Working calendar" meta="Due dates, “late” and “at risk” are counted in working days from this calendar." />
      <div className="flex flex-col gap-4">
        <Card title="Working week">
          <fieldset className="flex flex-col gap-2 p-4">
            <legend className="sr-only">Working week</legend>
            {[
              { value: "mon_fri", label: "Monday to Friday" },
              { value: "mon_sat", label: "Monday to Saturday" },
            ].map((o) => (
              <label key={o.value} className="flex items-center gap-2 text-body">
                <input
                  type="radio"
                  name="work_week"
                  value={o.value}
                  checked={workWeek === o.value}
                  disabled={!workWeek}
                  onChange={() => {
                    setSelectedWeek(o.value);
                    saveSettings.mutate(
                      { organisation: { work_week: o.value as "mon_fri" | "mon_sat" } },
                      {
                        onSuccess: () => toast({ title: `Working week set to ${o.label}` }),
                        onError: (error) => {
                          setSelectedWeek(undefined);
                          toast({ title: "Working week not changed", description: error.message });
                        },
                      },
                    );
                  }}
                />
                {o.label}
              </label>
            ))}
          </fieldset>
        </Card>

        <Card
          title="Holidays"
          actions={
            <Field label="Year" className="w-28">
              {(a) => (
                <Select {...a} value={year} onChange={(e) => setYear(Number(e.target.value))}>
                  {[thisYear - 1, thisYear, thisYear + 1].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </Select>
              )}
            </Field>
          }
        >
          <form onSubmit={submit} className="flex flex-wrap items-end gap-3 border-b border-border p-4">
            <Field label="Date" error={addError?.field("date") ?? addError?.field("non_field_errors")}>
              {(a) => <TextInput {...a} type="date" required value={date} onChange={(e) => setDate(e.target.value)} />}
            </Field>
            <Field label="Holiday name" className="min-w-56 flex-1" error={addError?.field("name")}>
              {(a) => <TextInput {...a} required value={name} onChange={(e) => setName(e.target.value)} />}
            </Field>
            <Button type="submit" icon={<Plus size={16} aria-hidden="true" />} busy={add.isPending} disabled={!date || !name}>
              Add holiday
            </Button>
          </form>
          <DataState
            isPending={holidays.isPending}
            error={holidays.error}
            isEmpty={(holidays.data ?? []).length === 0}
            onRetry={() => holidays.refetch()}
            empty={<EmptyState message={`No holidays for ${year} yet. Add the firm's holiday list above.`} />}
          >
            <table className={tableClass}>
              <thead>
                <tr>
                  <th scope="col" className={thClass}>Date</th>
                  <th scope="col" className={thClass}>Day</th>
                  <th scope="col" className={thClass}>Holiday</th>
                  <th scope="col" className={thClass}><span className="sr-only">Remove</span></th>
                </tr>
              </thead>
              <tbody>
                {(holidays.data ?? []).map((h) => (
                  <tr key={h.id}>
                    <td className={tdClass}>{formatDate(h.date)}</td>
                    <td className={tdClass}>{WEEKDAY.format(new Date(`${h.date}T00:00:00Z`))}</td>
                    <td className={tdClass}>{h.name}</td>
                    <td className={`${tdClass} text-right`}>
                      <Button size="sm" variant="ghost" aria-label={`Remove ${h.name}`} onClick={() => remove.mutate(h.id)}>
                        <Trash2 size={14} aria-hidden="true" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataState>
        </Card>
      </div>
    </>
  );
}
