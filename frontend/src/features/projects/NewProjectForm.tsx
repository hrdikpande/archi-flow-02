import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router";

import { Button } from "@/components/ui/Button";
import { Field, Select, TextInput } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { type PersonOption, UserPicker } from "@/components/ui/UserPicker";
import { api, ApiError, type Schemas, unwrap } from "@/lib/api/client";
import type { Me } from "@/lib/auth/useMe";

import { PROJECT_TYPES } from "./api";

/** F-01: project record. The lead becomes the project's PL. */
export function NewProjectForm({ me, onDone }: { me: Me; onDone: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const clients = useQuery({
    queryKey: ["external-orgs", "clients"],
    queryFn: () => unwrap(api.GET("/api/v1/external-orgs", { params: { query: { kind: "client", page_size: 200 } } })),
  });
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [type, setType] = useState("hospital");
  const [location, setLocation] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [cad, setCad] = useState("");
  const isLeadSelf = me.org_role === "staff";
  const [lead, setLead] = useState<PersonOption | null>(isLeadSelf ? { id: me.id, full_name: me.full_name, email: me.email } : null);

  const create = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST("/api/v1/projects", {
          body: {
            code,
            name,
            client: client || null,
            type: type as Schemas["ProjectTypeEnum"],
            location,
            start_date: start || null,
            end_date: end || null,
            cad_versions: cad.split(",").map((s) => s.trim()).filter(Boolean),
            lead_id: lead?.id ?? null,
          } as Schemas["ProjectCreateRequest"],
        }),
      ),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
      toast({ title: `${project.code} ${project.name} created` });
      onDone();
      navigate(`/projects/${project.id}/stages`);
    },
  });
  const error = create.error instanceof ApiError ? create.error : null;
  const codeError = error?.field("code") ?? (error?.body.field === "code" ? error.message : undefined);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {error && !codeError && Object.keys(error.errors).length === 0 && <p role="alert" className="text-small text-danger">{error.message}</p>}
      <Field label="Project code" hint="Format YYYY-NNN, e.g. 2026-014." error={codeError}>
        {(a) => <TextInput {...a} required className="mono" value={code} onChange={(e) => setCode(e.target.value)} />}
      </Field>
      <Field label="Name" error={error?.field("name")}>{(a) => <TextInput {...a} required value={name} onChange={(e) => setName(e.target.value)} />}</Field>
      <Field label="Client" hint="Add clients in Contacts › Organisations.">
        {(a) => (
          <Select {...a} value={client} onChange={(e) => setClient(e.target.value)}>
            <option value="">Not set</option>
            {(clients.data?.results ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        )}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          {(a) => (
            <Select {...a} value={type} onChange={(e) => setType(e.target.value)}>
              {PROJECT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Location">{(a) => <TextInput {...a} value={location} onChange={(e) => setLocation(e.target.value)} />}</Field>
        <Field label="Start">{(a) => <TextInput {...a} type="date" value={start} onChange={(e) => setStart(e.target.value)} />}</Field>
        <Field label="End" error={error?.field("end_date")}>{(a) => <TextInput {...a} type="date" value={end} onChange={(e) => setEnd(e.target.value)} />}</Field>
      </div>
      <Field label="CAD versions in use" hint="Comma separated, e.g. Revit 2024, AutoCAD 2023.">
        {(a) => <TextInput {...a} value={cad} onChange={(e) => setCad(e.target.value)} />}
      </Field>
      <Field label="Project lead" hint={isLeadSelf ? "You lead projects you create." : "Becomes the project's PL."}>
        {(a) => <UserPicker {...a} value={lead} onChange={setLead} />}
      </Field>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" busy={create.isPending} disabled={!code || !name}>Create project</Button>
        <Button onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}
