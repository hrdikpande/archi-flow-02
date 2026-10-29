import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, UserRoundCog } from "lucide-react";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Dialog";
import { Field, TextInput } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { type PersonOption, UserPicker } from "@/components/ui/UserPicker";
import { api, unwrap } from "@/lib/api/client";
import { useMe } from "@/lib/auth/useMe";
import { formatDate, todayISO } from "@/lib/format";

/** F-12: "while on leave, new reviews go to my delegate between two dates". */
export function DelegationButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button icon={<UserRoundCog size={16} aria-hidden="true" />} onClick={() => setOpen(true)}>Away? Set a delegate</Button>
      {open && <DelegationDrawer onClose={() => setOpen(false)} />}
    </>
  );
}

function DelegationDrawer({ onClose }: { onClose: () => void }) {
  const me = useMe().data;
  const queryClient = useQueryClient();
  const toast = useToast();
  const list = useQuery({ queryKey: ["delegations"], queryFn: () => unwrap(api.GET("/api/v1/delegations")) });
  const [delegate, setDelegate] = useState<PersonOption | null>(null);
  const [start, setStart] = useState(todayISO());
  const [end, setEnd] = useState(todayISO());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["delegations"] });
    queryClient.invalidateQueries({ queryKey: ["reviews"] });
  };
  const create = useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/delegations", { body: { delegate: delegate!.id, start, end, note } })),
    onSuccess: (d) => {
      refresh();
      toast({ title: `Reviews go to ${d.delegate_detail.short_name} from ${formatDate(d.start)} to ${formatDate(d.end)}` });
      setDelegate(null);
    },
    onError: (e) => setError(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE("/api/v1/delegations/{id}", { params: { path: { id } } })),
    onSuccess: refresh,
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(undefined);
    if (!delegate) return setError("Choose who covers your reviews.");
    create.mutate();
  };
  const rows = list.data ?? [];

  return (
    <Drawer open onOpenChange={(o) => !o && onClose()} title="Review delegation">
      <p className="mb-3 text-small text-muted">
        Between these dates, sheets waiting for your check go to your delegate on projects where they review (PL, DL or senior reviewer). Elsewhere they stay with you and are escalated to the DL after 3 working days.
      </p>
      <form className="flex flex-col gap-3" onSubmit={submit}>
        <Field label="Delegate">
          {(p) => <UserPicker {...p} value={delegate} onChange={setDelegate} />}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="From">{(p) => <TextInput {...p} type="date" value={start} onChange={(e) => setStart(e.target.value)} required />}</Field>
          <Field label="To">{(p) => <TextInput {...p} type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} required />}</Field>
        </div>
        <Field label="Note (optional)">{(p) => <TextInput {...p} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />}</Field>
        {error && <p role="alert" className="text-small text-danger">{error}</p>}
        <div className="flex justify-end">
          <Button type="submit" variant="primary" busy={create.isPending}>Set delegate</Button>
        </div>
      </form>
      <h3 className="mt-6 mb-2 text-body font-semibold">Delegations</h3>
      {rows.length === 0 ? (
        <p className="text-small text-muted">None set.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {rows.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2 text-body">
              <span>
                {d.user === me?.id ? "You" : d.user_detail.short_name} → {d.delegate === me?.id ? "you" : d.delegate_detail.short_name}
                <span className="text-small text-muted"> · {formatDate(d.start)} – {formatDate(d.end)}{d.note && ` · ${d.note}`}</span>
              </span>
              {d.user === me?.id && (
                <Button size="sm" variant="ghost" aria-label={`Remove delegation to ${d.delegate_detail.short_name}`} icon={<Trash2 size={14} aria-hidden="true" />} onClick={() => remove.mutate(d.id)} />
              )}
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  );
}
