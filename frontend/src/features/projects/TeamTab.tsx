import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, UserPlus } from "lucide-react";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog, Drawer } from "@/components/ui/Dialog";
import { Field, Select } from "@/components/ui/Field";
import { Card, tableClass, tdClass, thClass } from "@/components/ui/PageHeader";
import { DataState, EmptyState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { type PersonOption, UserPicker } from "@/components/ui/UserPicker";
import { api, ApiError, type Schemas, unwrap } from "@/lib/api/client";

import { type Member, projectKeys, ROLE_LABELS, useDisciplines, useMembers } from "./api";
import { useProjectContext } from "./ProjectLayout";

const ROLES = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }));

/** The project team with roles (F-01, F-38). Hours and allocations are added in S5. */
export function TeamTab({ children }: { children?: React.ReactNode }) {
  const { project } = useProjectContext();
  const members = useMembers(project.id);
  const disciplines = useDisciplines();
  const queryClient = useQueryClient();
  const toast = useToast();
  const canEdit = !!project.my_permissions.edit_project;
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Member | null>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: projectKeys.members(project.id) });
    queryClient.invalidateQueries({ queryKey: projectKeys.detail(project.id) });
  };
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Schemas["PatchedMembershipUpdateRequest"] }) =>
      unwrap(api.PATCH("/api/v1/members/{id}", { params: { path: { id } }, body })),
    onSuccess: refresh,
    onError: (e) => toast({ title: "Not changed", description: e.message }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE("/api/v1/members/{id}", { params: { path: { id } } })),
    onSuccess: () => {
      refresh();
      toast({ title: `${removing?.user.short_name} removed from the team` });
      setRemoving(null);
    },
  });
  const rows = members.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <Card
        title="Team"
        actions={canEdit && <Button size="sm" variant="primary" icon={<UserPlus size={14} aria-hidden="true" />} onClick={() => setAdding(true)}>Add person</Button>}
      >
        <DataState isPending={members.isPending} error={members.error} isEmpty={rows.length === 0} onRetry={() => members.refetch()} empty={<EmptyState message="No one is on this project yet." />}>
          <table className={tableClass}>
            <thead>
              <tr>
                <th scope="col" className={thClass}>Person</th>
                <th scope="col" className={thClass}>Role</th>
                <th scope="col" className={thClass}>Discipline</th>
                <th scope="col" className={thClass}><span className="sr-only">Remove</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id}>
                  <td className={tdClass}>
                    {m.user.full_name || m.user.email}
                    <span className="ml-2 text-small text-muted">{m.user.email}</span>
                  </td>
                  <td className={tdClass}>
                    {canEdit ? (
                      <Select aria-label={`Role for ${m.user.short_name}`} className="h-8 w-52" value={m.role} onChange={(e) => update.mutate({ id: m.id, body: { role: e.target.value as Schemas["ProjectRoleEnum"] } })}>
                        {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </Select>
                    ) : (
                      ROLE_LABELS[m.role]
                    )}
                  </td>
                  <td className={tdClass}>
                    {canEdit ? (
                      <Select aria-label={`Discipline for ${m.user.short_name}`} className="h-8 w-44" value={m.discipline ?? ""} onChange={(e) => update.mutate({ id: m.id, body: { discipline: e.target.value || null } })}>
                        <option value="">—</option>
                        {(disciplines.data ?? []).map((d) => <option key={d.id} value={d.id}>{d.code} {d.name}</option>)}
                      </Select>
                    ) : (
                      disciplines.data?.find((d) => d.id === m.discipline)?.name ?? "—"
                    )}
                  </td>
                  <td className={`${tdClass} text-right`}>
                    {canEdit && (
                      <Button size="sm" variant="ghost" aria-label={`Remove ${m.user.short_name}`} onClick={() => setRemoving(m)}>
                        <Trash2 size={14} aria-hidden="true" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </Card>
      {children}
      <Drawer open={adding} onOpenChange={setAdding} title="Add person to the team">
        {adding && <AddMemberForm onDone={() => setAdding(false)} />}
      </Drawer>
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Remove ${removing?.user.short_name} from the team?`}
        confirmLabel="Remove from team"
        destructive
        busy={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing.id)}
      >
        <p>They lose access to this project. Sheets they own or check must be reassigned first.</p>
        {remove.error && <p className="mt-2 text-danger">{remove.error.message}</p>}
      </ConfirmDialog>
    </div>
  );
}

function AddMemberForm({ onDone }: { onDone: () => void }) {
  const { project } = useProjectContext();
  const disciplines = useDisciplines();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [person, setPerson] = useState<PersonOption | null>(null);
  const [role, setRole] = useState("designer");
  const [discipline, setDiscipline] = useState("");
  const add = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST("/api/v1/projects/{project_pk}/members", {
          params: { path: { project_pk: project.id } },
          body: { user_id: person!.id, role: role as Schemas["ProjectRoleEnum"], discipline: discipline || null },
        }),
      ),
    onSuccess: (m) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.members(project.id) });
      toast({ title: `${m.user.short_name} added as ${ROLE_LABELS[m.role]}` });
      onDone();
    },
  });
  const error = add.error instanceof ApiError ? add.error : null;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    add.mutate();
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {error && <p role="alert" className="text-small text-danger">{error.message}</p>}
      <Field label="Person" hint="People appear after their first sign-in.">{(a) => <UserPicker {...a} value={person} onChange={setPerson} />}</Field>
      <Field label="Role">
        {(a) => (
          <Select {...a} value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </Select>
        )}
      </Field>
      <Field label="Discipline">
        {(a) => (
          <Select {...a} value={discipline} onChange={(e) => setDiscipline(e.target.value)}>
            <option value="">—</option>
            {(disciplines.data ?? []).map((d) => <option key={d.id} value={d.id}>{d.code} {d.name}</option>)}
          </Select>
        )}
      </Field>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" busy={add.isPending} disabled={!person}>Add to team</Button>
        <Button onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}
