import * as Dialog from "@radix-ui/react-dialog";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { MoreHorizontal, Upload } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link } from "react-router";

import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api/client";
import { uploadFile } from "@/lib/upload";

import { type AllowedAction, type SheetDetail, usePrecheck, useTransition } from "./api";

/** The 1–2 next actions allowed for this user, primary first; the rest in a menu.
 * Disabled actions are hidden, except Issue, which says why it is blocked (DESIGN.md §4). */
export function ActionBar({ sheet }: { sheet: SheetDetail }) {
  const move = useTransition(sheet.id, sheet.project);
  const toast = useToast();
  const [dialog, setDialog] = useState<AllowedAction | null>(null);
  const canSubmit = sheet.allowed_actions.some((a) => a.action === "submit");
  const precheck = usePrecheck(sheet.id, canSubmit);
  const [checking, setChecking] = useState(false);
  const actions = sheet.allowed_actions;
  const primary = actions.filter((a) => a.primary).slice(0, 2);
  const rest = actions.filter((a) => !primary.includes(a));

  const run = (a: AllowedAction) => {
    if (a.action === "issue") return;
    if (a.action === "submit" && (precheck.data?.items.length ?? 0) > 0) return setChecking(true);
    if (a.needs_reason || a.action === "return") return setDialog(a);
    move.mutate(
      { action: a.action },
      {
        onSuccess: (s) => toast({ title: `${s.number}: ${a.label}` }),
        onError: (e) => toast({ title: `${a.label} not possible`, description: e.message }),
      },
    );
  };

  const button = (a: AllowedAction, variant: "primary" | "secondary") => {
    if (a.action === "issue") {
      return a.blocked_reason ? (
        <span key={a.action} className="inline-flex items-center gap-2">
          <Button variant={variant} disabled>Issue</Button>
          <span className="text-small text-muted">{a.blocked_reason}</span>
        </span>
      ) : (
        <Link key={a.action} to={`/projects/${sheet.project}/issue?sheets=${sheet.id}`} className="inline-flex h-9 items-center rounded-sm bg-primary px-3 font-semibold text-on-primary hover:bg-primary-hover">
          Issue…
        </Link>
      );
    }
    if (a.blocked_reason) {
      return (
        <span key={a.action} className="inline-flex items-center gap-2">
          <Button variant={variant} disabled>{a.label}</Button>
          <span className="text-small text-muted">{a.blocked_reason}</span>
        </span>
      );
    }
    return (
      <Button key={a.action} variant={variant} busy={move.isPending && move.variables?.action === a.action} onClick={() => run(a)} title={a.hint || undefined}>
        {a.label}
      </Button>
    );
  };

  if (actions.length === 0) return <p className="text-small text-muted">No actions for you on this sheet right now.</p>;
  return (
    <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Sheet actions">
      {primary.map((a, i) => button(a, i === 0 ? "primary" : "secondary"))}
      {rest.length > 0 && (
        <Menu.Root>
          <Menu.Trigger asChild>
            <Button variant="ghost" icon={<MoreHorizontal size={16} aria-hidden="true" />} aria-label="More actions">More</Button>
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Content align="start" sideOffset={4} className="z-50 min-w-52 rounded-md border border-border bg-surface p-1 shadow-overlay">
              {rest.map((a) => (
                <Menu.Item
                  key={a.action}
                  disabled={!!a.blocked_reason}
                  onSelect={() => run(a)}
                  className="flex cursor-pointer flex-col rounded-sm px-3 py-1.5 text-body outline-none data-[disabled]:opacity-60 data-[highlighted]:bg-surface-muted"
                >
                  {a.label}
                  {(a.blocked_reason || a.hint) && <span className="text-small text-muted">{a.blocked_reason || a.hint}</span>}
                </Menu.Item>
              ))}
            </Menu.Content>
          </Menu.Portal>
        </Menu.Root>
      )}
      <ActionDialog sheet={sheet} action={dialog} onClose={() => setDialog(null)} />
      {precheck.data && <PrecheckDialog sheet={sheet} open={checking} items={precheck.data.items} onClose={() => setChecking(false)} />}
    </div>
  );
}

type PrecheckItem = { id: number; checklist: string; text: string; mandatory: boolean; ticked: boolean };

/** F-13 / S-19: the designer ticks the pre-check list in the Submit dialog. */
function PrecheckDialog({ sheet, open, items, onClose }: { sheet: SheetDetail; open: boolean; items: PrecheckItem[]; onClose: () => void }) {
  const move = useTransition(sheet.id, sheet.project);
  const toast = useToast();
  const [ticked, setTicked] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");
  const missing = items.filter((i) => i.mandatory && !ticked.has(i.id));
  const groups = [...new Set(items.map((i) => i.checklist))];
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    move.mutate(
      { action: "submit", checklist: [...ticked] },
      {
        onSuccess: (s) => {
          toast({ title: `${s.number}: submitted for check` });
          onClose();
        },
        onError: (err) => setError(err.message),
      },
    );
  };
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[85vh] w-[520px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-border bg-surface p-6 shadow-overlay">
          <Dialog.Title className="text-title font-semibold">Submit {sheet.number} for check</Dialog.Title>
          <Dialog.Description className="mt-1 text-body text-muted">Tick the pre-check list. Items marked required must be ticked; your ticks go to the checker with the sheet.</Dialog.Description>
          <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
            {groups.map((g) => (
              <fieldset key={g} className="flex flex-col gap-1.5">
                <legend className="mb-1 text-body font-semibold">{g}</legend>
                {items.filter((i) => i.checklist === g).map((i) => (
                  <label key={i.id} className="flex items-start gap-2 text-body">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={ticked.has(i.id)}
                      onChange={(e) => {
                        const next = new Set(ticked);
                        if (e.target.checked) next.add(i.id);
                        else next.delete(i.id);
                        setTicked(next);
                      }}
                    />
                    <span>{i.text}{i.mandatory && <span className="text-small text-muted"> (required)</span>}</span>
                  </label>
                ))}
              </fieldset>
            ))}
            {error && <p role="alert" className="text-small text-danger">{error}</p>}
            <div className="flex items-center justify-end gap-2">
              {missing.length > 0 && <span className="text-small text-muted">{missing.length} required item{missing.length === 1 ? "" : "s"} left</span>}
              <Button onClick={onClose}>Cancel</Button>
              <Button type="submit" variant="primary" busy={move.isPending} disabled={missing.length > 0}>Submit for check</Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** The ticks the designer gave, shown to the checker for the round under review (F-13). */
export function PrecheckPanel({ sheetId, state }: { sheetId: string; state: string }) {
  const reviewing = state === "ready_for_check" || state === "in_check";
  const precheck = usePrecheck(sheetId, reviewing);
  if (!reviewing || !precheck.data?.submitted_at || precheck.data.items.length === 0) return null;
  return (
    <section aria-label="Designer's pre-check" className="rounded-md border border-border p-3">
      <h3 className="mb-1 text-body font-semibold">Designer's pre-check · round {precheck.data.round}</h3>
      <ul className="flex flex-col gap-0.5 text-small">
        {precheck.data.items.map((i) => (
          <li key={i.id}>
            {i.ticked ? "✓" : "✗"} <span className="sr-only">{i.ticked ? "Ticked:" : "Not ticked:"}</span> {i.text}
            {i.mandatory && !i.ticked && <span className="text-danger"> (required, not ticked)</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ActionDialog({ sheet, action, onClose }: { sheet: SheetDetail; action: AllowedAction | null; onClose: () => void }) {
  const move = useTransition(sheet.id, sheet.project);
  const toast = useToast();
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isReturn = action?.action === "return";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!action) return;
    setBusy(true);
    setError("");
    try {
      const redline_upload_ids: string[] = [];
      for (const file of files) {
        const kind = file.type.startsWith("image/") ? "image" : "document";
        redline_upload_ids.push((await uploadFile(file, kind)).id);
      }
      const s = await move.mutateAsync(isReturn ? { action: action.action, comment: text, redline_upload_ids } : { action: action.action, reason: text });
      toast({ title: `${s.number}: ${action.label}` });
      setText("");
      setFiles([]);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : "Not possible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog.Root open={action !== null} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[480px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface p-6 shadow-overlay">
          <Dialog.Title className="text-title font-semibold">
            {action?.label} {sheet.number}
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-body text-muted">
            {isReturn ? "Say what to change, and attach the redlined PDF or photos. The designer is told at once." : action?.hint || "The reason is recorded in the sheet's history."}
          </Dialog.Description>
          <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
            {error && <p role="alert" className="text-small text-danger">{error}</p>}
            <Field label={isReturn ? "Comment" : "Reason"}>
              {(a) => <textarea {...a} rows={4} className="w-full rounded-sm border border-border bg-surface p-2 text-body" value={text} onChange={(e) => setText(e.target.value)} required={!isReturn} />}
            </Field>
            {isReturn && (
              <label className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-sm border border-border px-3 py-1.5 text-body hover:bg-surface-muted">
                <Upload size={14} aria-hidden="true" />
                {files.length ? `${files.length} redline file${files.length > 1 ? "s" : ""}` : "Attach redlines (PDF or images)"}
                <input type="file" multiple accept="application/pdf,image/jpeg,image/png" className="sr-only" onChange={(e) => setFiles([...(e.target.files ?? [])])} />
              </label>
            )}
            <div className="flex justify-end gap-2">
              <Button onClick={onClose}>Cancel</Button>
              <Button type="submit" variant={action?.action === "cancel" || action?.action === "supersede_sheet" ? "danger" : "primary"} busy={busy} disabled={isReturn ? !text.trim() && files.length === 0 : !text.trim()}>
                {action?.label}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
