import * as Tabs from "@radix-ui/react-tabs";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { type FormEvent, useDeferredValue, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Dialog";
import { Field, Select, TextInput } from "@/components/ui/Field";
import { Card, PageHeader, tableClass, tdClass, thClass } from "@/components/ui/PageHeader";
import { DataState, EmptyState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, type Schemas, unwrap } from "@/lib/api/client";
import { cursorFrom } from "@/lib/api/cursor";
import type { Me } from "@/lib/auth/useMe";

type Contact = Schemas["Contact"];
type ExternalOrg = Schemas["ExternalOrg"];
type Kind = NonNullable<ExternalOrg["kind"]>;

const KINDS: { value: Kind; label: string }[] = [
  { value: "client", label: "Client" },
  { value: "consultant", label: "Consultant" },
  { value: "contractor", label: "Contractor" },
  { value: "authority", label: "Authority" },
  { value: "other", label: "Other" },
];
const kindLabel = (k?: string) => KINDS.find((x) => x.value === k)?.label ?? k ?? "";

/** F-43: clients, consultants (incl. structural), contractors and authorities, reused across projects. */
export function ContactsPage({ me }: { me: Me }) {
  const canEdit = me.capabilities.manage_contacts;
  const [tab, setTab] = useState("people");
  const [q, setQ] = useState("");
  const search = useDeferredValue(q.trim());
  const [editingContact, setEditingContact] = useState<Contact | "new" | null>(null);
  const [editingOrg, setEditingOrg] = useState<ExternalOrg | "new" | null>(null);

  return (
    <>
      <PageHeader
        title="Contacts"
        meta="Add a person or organisation once and reuse it on every project and transmittal."
        actions={
          canEdit && (
            <Button
              variant="primary"
              icon={<Plus size={16} aria-hidden="true" />}
              onClick={() => (tab === "people" ? setEditingContact("new") : setEditingOrg("new"))}
            >
              {tab === "people" ? "Add contact" : "Add organisation"}
            </Button>
          )
        }
      />
      <Tabs.Root value={tab} onValueChange={setTab}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <Tabs.List aria-label="Contact lists" className="flex gap-1 rounded-md bg-surface-muted p-1">
            {[
              { value: "people", label: "People" },
              { value: "orgs", label: "Organisations" },
            ].map((t) => (
              <Tabs.Trigger
                key={t.value}
                value={t.value}
                className="rounded-sm px-3 py-1.5 text-body data-[state=active]:bg-surface data-[state=active]:font-semibold"
              >
                {t.label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
          <div className="relative w-72 max-w-full">
            <Search size={16} aria-hidden="true" className="pointer-events-none absolute top-2.5 left-2.5 text-muted" />
            <TextInput aria-label="Search contacts" placeholder="Search name, email, organisation" className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <Tabs.Content value="people">
          <PeopleTable search={search} canEdit={canEdit} onEdit={setEditingContact} />
        </Tabs.Content>
        <Tabs.Content value="orgs">
          <OrgsTable search={search} canEdit={canEdit} onEdit={setEditingOrg} />
        </Tabs.Content>
      </Tabs.Root>
      <Drawer open={editingContact !== null} onOpenChange={(o) => !o && setEditingContact(null)} title={editingContact === "new" ? "Add contact" : "Edit contact"}>
        {editingContact !== null && <ContactForm contact={editingContact === "new" ? null : editingContact} onDone={() => setEditingContact(null)} />}
      </Drawer>
      <Drawer open={editingOrg !== null} onOpenChange={(o) => !o && setEditingOrg(null)} title={editingOrg === "new" ? "Add organisation" : "Edit organisation"}>
        {editingOrg !== null && <OrgForm org={editingOrg === "new" ? null : editingOrg} onDone={() => setEditingOrg(null)} />}
      </Drawer>
    </>
  );
}

function PeopleTable({ search, canEdit, onEdit }: { search: string; canEdit: boolean; onEdit: (c: Contact) => void }) {
  const query = useInfiniteQuery({
    queryKey: ["contacts", search],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => unwrap(api.GET("/api/v1/contacts", { params: { query: { q: search || undefined, cursor: pageParam } } })),
    getNextPageParam: (last) => cursorFrom(last.next),
  });
  const rows = query.data?.pages.flatMap((p) => p.results) ?? [];
  return (
    <Card>
      <DataState
        isPending={query.isPending}
        error={query.error}
        isEmpty={rows.length === 0}
        onRetry={() => query.refetch()}
        empty={<EmptyState message={search ? `No contacts match “${search}”.` : "No contacts yet. Add the client's and consultants' people."} />}
      >
        <table className={tableClass}>
          <thead>
            <tr>
              <th scope="col" className={thClass}>Name</th>
              <th scope="col" className={thClass}>Organisation</th>
              <th scope="col" className={thClass}>Designation</th>
              <th scope="col" className={thClass}>Email</th>
              <th scope="col" className={thClass}>Phone</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className={c.is_active === false ? "text-muted" : undefined}>
                <td className={tdClass}>
                  {canEdit ? (
                    <button type="button" className="text-left text-primary hover:underline" onClick={() => onEdit(c)}>{c.full_name}</button>
                  ) : (
                    c.full_name
                  )}
                </td>
                <td className={tdClass}>{c.external_org_name ?? "—"}</td>
                <td className={tdClass}>{c.designation || "—"}</td>
                <td className={tdClass}>{c.email ? <a className="text-primary hover:underline" href={`mailto:${c.email}`}>{c.email}</a> : "By hand only"}</td>
                <td className={tdClass}>{c.phone || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {query.hasNextPage && (
          <div className="p-3"><Button size="sm" busy={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>Show more</Button></div>
        )}
      </DataState>
    </Card>
  );
}

function OrgsTable({ search, canEdit, onEdit }: { search: string; canEdit: boolean; onEdit: (o: ExternalOrg) => void }) {
  const query = useInfiniteQuery({
    queryKey: ["external-orgs", search],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => unwrap(api.GET("/api/v1/external-orgs", { params: { query: { q: search || undefined, cursor: pageParam } } })),
    getNextPageParam: (last) => cursorFrom(last.next),
  });
  const rows = query.data?.pages.flatMap((p) => p.results) ?? [];
  return (
    <Card>
      <DataState
        isPending={query.isPending}
        error={query.error}
        isEmpty={rows.length === 0}
        onRetry={() => query.refetch()}
        empty={<EmptyState message={search ? `No organisations match “${search}”.` : "No organisations yet."} />}
      >
        <table className={tableClass}>
          <thead>
            <tr>
              <th scope="col" className={thClass}>Organisation</th>
              <th scope="col" className={thClass}>Type</th>
              <th scope="col" className={thClass}>Email</th>
              <th scope="col" className={`${thClass} text-right`}>People</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id} className={o.is_active === false ? "text-muted" : undefined}>
                <td className={tdClass}>
                  {canEdit ? (
                    <button type="button" className="text-left text-primary hover:underline" onClick={() => onEdit(o)}>{o.name}</button>
                  ) : (
                    o.name
                  )}
                </td>
                <td className={tdClass}>{kindLabel(o.kind)}</td>
                <td className={tdClass}>{o.email || "—"}</td>
                <td className={`${tdClass} text-right`}>{o.contact_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {query.hasNextPage && (
          <div className="p-3"><Button size="sm" busy={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>Show more</Button></div>
        )}
      </DataState>
    </Card>
  );
}

function ContactForm({ contact, onDone }: { contact: Contact | null; onDone: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const orgs = useQuery({ queryKey: ["external-orgs", "all"], queryFn: () => unwrap(api.GET("/api/v1/external-orgs", { params: { query: { page_size: 200 } } })) });
  const [fullName, setFullName] = useState(contact?.full_name ?? "");
  const [email, setEmail] = useState(contact?.email ?? "");
  const [phone, setPhone] = useState(contact?.phone ?? "");
  const [designation, setDesignation] = useState(contact?.designation ?? "");
  const [orgId, setOrgId] = useState(contact?.external_org ?? "");
  const [active, setActive] = useState(contact?.is_active ?? true);

  const save = useMutation({
    mutationFn: (confirmDuplicate: boolean) => {
      const body = {
        full_name: fullName,
        email,
        phone,
        designation,
        external_org: orgId || null,
        is_active: active,
        confirm_duplicate: confirmDuplicate,
      };
      return contact
        ? unwrap(api.PATCH("/api/v1/contacts/{id}", { params: { path: { id: contact.id } }, body }))
        : unwrap(api.POST("/api/v1/contacts", { body }));
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["external-orgs"] });
      toast({ title: `${saved.full_name} saved` });
      onDone();
    },
  });
  const error = save.error instanceof ApiError ? save.error : null;
  const duplicate = error?.code === "duplicate_email" ? error : null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate(false);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {duplicate && (
        <div role="alert" className="flex flex-col gap-2 rounded-sm px-3 py-2 text-small" style={{ color: "var(--flag-at_risk-fg)", background: "var(--flag-at_risk-bg)" }}>
          <p>{duplicate.message}</p>
          <div>
            <Button size="sm" onClick={() => save.mutate(true)} busy={save.isPending}>Save anyway</Button>
          </div>
        </div>
      )}
      {error && !duplicate && Object.keys(error.errors).length === 0 && <p role="alert" className="text-small text-danger">{error.message}</p>}
      <Field label="Full name" error={error?.field("full_name")}>
        {(a) => <TextInput {...a} required value={fullName} onChange={(e) => setFullName(e.target.value)} />}
      </Field>
      <Field label="Organisation" error={error?.field("external_org")}>
        {(a) => (
          <Select {...a} value={orgId ?? ""} onChange={(e) => setOrgId(e.target.value)}>
            <option value="">No organisation</option>
            {(orgs.data?.results ?? []).map((o) => (
              <option key={o.id} value={o.id}>{o.name} ({kindLabel(o.kind)})</option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Designation">{(a) => <TextInput {...a} value={designation} onChange={(e) => setDesignation(e.target.value)} />}</Field>
      <Field label="Email" hint="Leave empty for people who receive drawings by hand." error={error?.field("email")}>
        {(a) => <TextInput {...a} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
      </Field>
      <Field label="Phone" error={error?.field("phone")}>{(a) => <TextInput {...a} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />}</Field>
      <label className="flex items-center gap-2 text-body">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Active (can receive transmittals)
      </label>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" busy={save.isPending && !duplicate} disabled={!fullName}>Save contact</Button>
        <Button onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}

function OrgForm({ org, onDone }: { org: ExternalOrg | null; onDone: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState(org?.name ?? "");
  const [kind, setKind] = useState<Kind>(org?.kind ?? "client");
  const [email, setEmail] = useState(org?.email ?? "");
  const [phone, setPhone] = useState(org?.phone ?? "");
  const [address, setAddress] = useState(org?.address ?? "");
  const save = useMutation({
    mutationFn: () => {
      const body = { name, kind, email, phone, address };
      return org
        ? unwrap(api.PATCH("/api/v1/external-orgs/{id}", { params: { path: { id: org.id } }, body }))
        : unwrap(api.POST("/api/v1/external-orgs", { body }));
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["external-orgs"] });
      toast({ title: `${saved.name} saved` });
      onDone();
    },
  });
  const error = save.error instanceof ApiError ? save.error : null;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate();
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {error && <p role="alert" className="text-small text-danger">{error.field("non_field_errors") ?? error.message}</p>}
      <Field label="Name" error={error?.field("name")}>{(a) => <TextInput {...a} required value={name} onChange={(e) => setName(e.target.value)} />}</Field>
      <Field label="Type">
        {(a) => (
          <Select {...a} value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
            {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </Select>
        )}
      </Field>
      <Field label="Email" error={error?.field("email")}>{(a) => <TextInput {...a} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
      <Field label="Phone">{(a) => <TextInput {...a} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />}</Field>
      <Field label="Address">{(a) => <TextInput {...a} value={address} onChange={(e) => setAddress(e.target.value)} />}</Field>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" busy={save.isPending} disabled={!name}>Save organisation</Button>
        <Button onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}
