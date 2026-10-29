import { useMutation } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Dialog";
import { Field, Select, TextInput } from "@/components/ui/Field";
import { Card, PageHeader, tableClass, tdClass, thClass } from "@/components/ui/PageHeader";
import { DataState, EmptyState } from "@/components/ui/States";
import { SubNav } from "@/components/ui/SubNav";
import { useToast } from "@/components/ui/Toast";
import { useDisciplines } from "@/features/projects/api";
import { api, type Schemas, unwrap } from "@/lib/api/client";
import type { Me } from "@/lib/auth/useMe";
import { formatDate, formatINR, todayISO } from "@/lib/format";

import { LEAVE_LABELS, type StaffRow, useInvalidatePeople, useLeave, useStaff } from "./api";
import { peopleTabs } from "./WorkloadPage";

const ORG_ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  accounts: "Accounts",
  staff: "Staff",
};

/** F-16 staff directory: discipline, role, team, weekly capacity, leave. Admin or DL edits. */
export function StaffPage({ me }: { me: Me }) {
  const staff = useStaff();
  const leave = useLeave();
  const [editing, setEditing] = useState<StaffRow | null>(null);
  const rows = staff.data ?? [];
  const today = todayISO();
  const upcoming = (userId: string) => (leave.data ?? []).filter((l) => l.user === userId && l.end >= today);

  return (
    <>
      <PageHeader title="Workload" meta="Capacity is per person per week, net of leave and holidays. New SSO users have no discipline until it is set." />
      <SubNav label="Workload sections" items={peopleTabs(me)} />
      <Card title="Staff">
        <DataState isPending={staff.isPending} error={staff.error} isEmpty={rows.length === 0} onRetry={() => staff.refetch()} empty={<EmptyState message="No one to show." />}>
          <table className={tableClass}>
            <thead>
              <tr>
                <th scope="col" className={thClass}>Person</th>
                <th scope="col" className={thClass}>Discipline</th>
                <th scope="col" className={thClass}>Org role</th>
                <th scope="col" className={thClass}>Team</th>
                <th scope="col" className={`${thClass} text-right`}>Capacity / week</th>
                <th scope="col" className={thClass}>Upcoming leave</th>
                <th scope="col" className={thClass}><span className="sr-only">Edit</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.user.id}>
                  <td className={tdClass}>{r.user.full_name}</td>
                  <td className={tdClass}>{r.discipline_code ?? <span className="text-muted">Not set</span>}</td>
                  <td className={tdClass}>{ORG_ROLE_LABELS[r.org_role] ?? r.org_role}</td>
                  <td className={tdClass}>{r.team || "—"}</td>
                  <td className={`${tdClass} text-right tabular`}>{r.weekly_capacity_h} h</td>
                  <td className={tdClass}>
                    {upcoming(r.user.id).map((l) => (
                      <span key={l.id} className="mr-2 text-small">{formatDate(l.start)}–{formatDate(l.end)}</span>
                    ))}
                    {upcoming(r.user.id).length === 0 && "—"}
                  </td>
                  <td className={`${tdClass} text-right`}>
                    {r.can_manage && <Button size="sm" onClick={() => setEditing(r)}>Edit</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </Card>
      {editing && <StaffDrawer me={me} row={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function StaffDrawer({ me, row, onClose }: { me: Me; row: StaffRow; onClose: () => void }) {
  const disciplines = useDisciplines();
  const leave = useLeave(row.user.id);
  const invalidate = useInvalidatePeople();
  const toast = useToast();
  const isAdmin = me.org_role === "admin";
  const [form, setForm] = useState({
    discipline: row.discipline ?? "",
    team: row.team,
    weekly_capacity_h: row.weekly_capacity_h,
    cost_rate: row.cost_rate ?? "",
  });
  const [newLeave, setNewLeave] = useState({ start: "", end: "", type: "annual" as Schemas["LeaveTypeEnum"] });
  const [error, setError] = useState<string>();

  const save = useMutation({
    mutationFn: () =>
      unwrap(
        api.PATCH("/api/v1/staff/{id}", {
          params: { path: { id: row.user.id } },
          body: {
            discipline: form.discipline || null,
            team: form.team,
            weekly_capacity_h: form.weekly_capacity_h,
            ...(isAdmin ? { cost_rate: form.cost_rate === "" ? null : form.cost_rate } : {}),
          },
        }),
      ),
    onSuccess: () => {
      invalidate();
      toast({ title: `${row.user.short_name} updated` });
      onClose();
    },
    onError: (e) => setError(e.message),
  });
  const addLeave = useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/leave", { body: { user: row.user.id, ...newLeave } })),
    onSuccess: () => {
      invalidate();
      setNewLeave({ start: "", end: "", type: "annual" });
      toast({ title: "Leave added" });
    },
    onError: (e) => setError(e.message),
  });
  const removeLeave = useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE("/api/v1/leave/{id}", { params: { path: { id } } })),
    onSuccess: () => invalidate(),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(undefined);
    save.mutate();
  };

  return (
    <Drawer open onOpenChange={(o) => !o && onClose()} title={row.user.full_name}>
      <form className="flex flex-col gap-3" onSubmit={submit}>
        <Field label="Discipline">
          {(p) => (
            <Select {...p} value={form.discipline} onChange={(e) => setForm({ ...form, discipline: e.target.value })}>
              <option value="">Not set</option>
              {disciplines.data?.map((d) => <option key={d.id} value={d.id}>{d.code} · {d.name}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Team">
          {(p) => <TextInput {...p} value={form.team} maxLength={80} onChange={(e) => setForm({ ...form, team: e.target.value })} />}
        </Field>
        <Field label="Weekly capacity (hours)" hint="Part-time staff have their own capacity.">
          {(p) => <TextInput {...p} inputMode="decimal" value={form.weekly_capacity_h} onChange={(e) => setForm({ ...form, weekly_capacity_h: e.target.value })} />}
        </Field>
        {isAdmin && (
          <Field label="Cost rate per hour (₹)" hint={form.cost_rate ? formatINR(form.cost_rate) : "Only admins see this."}>
            {(p) => <TextInput {...p} inputMode="decimal" value={form.cost_rate} onChange={(e) => setForm({ ...form, cost_rate: e.target.value })} />}
          </Field>
        )}
        {error && <p role="alert" className="text-small text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" busy={save.isPending}>Save</Button>
        </div>
      </form>

      <h3 className="mt-6 mb-2 text-body font-semibold">Leave</h3>
      <ul className="mb-3 flex flex-col gap-1">
        {(leave.data ?? []).map((l) => (
          <li key={l.id} className="flex items-center justify-between text-body">
            <span>{formatDate(l.start)} – {formatDate(l.end)} · {LEAVE_LABELS[l.type ?? "annual"]}</span>
            <Button size="sm" variant="ghost" aria-label={`Remove leave from ${formatDate(l.start)}`} icon={<Trash2 size={14} aria-hidden="true" />} onClick={() => removeLeave.mutate(l.id)} />
          </li>
        ))}
        {leave.data?.length === 0 && <li className="text-small text-muted">No leave recorded.</li>}
      </ul>
      <form
        className="grid grid-cols-3 items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setError(undefined);
          addLeave.mutate();
        }}
      >
        <Field label="From">{(p) => <TextInput {...p} type="date" required value={newLeave.start} onChange={(e) => setNewLeave({ ...newLeave, start: e.target.value })} />}</Field>
        <Field label="To">{(p) => <TextInput {...p} type="date" required value={newLeave.end} onChange={(e) => setNewLeave({ ...newLeave, end: e.target.value })} />}</Field>
        <Field label="Type">
          {(p) => (
            <Select {...p} value={newLeave.type} onChange={(e) => setNewLeave({ ...newLeave, type: e.target.value as Schemas["LeaveTypeEnum"] })}>
              {Object.entries(LEAVE_LABELS).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </Select>
          )}
        </Field>
        <Button type="submit" className="col-span-3 justify-self-end" busy={addLeave.isPending}>Add leave</Button>
      </form>
    </Drawer>
  );
}
