import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Field, Select, TextInput } from "@/components/ui/Field";
import { Card, PageHeader, tableClass, tdClass, thClass } from "@/components/ui/PageHeader";
import { DataState, EmptyState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, type Schemas, unwrap } from "@/lib/api/client";

type Target = Schemas["NamingTargetEnum"];
const TARGETS: { value: Target; label: string }[] = [
  { value: "file_name", label: "File name" },
  { value: "sheet_number", label: "Sheet number" },
];

/** S-14 Naming rules (F-35, A-04) with a live tester. Projects can override in their settings. */
export function NamingRulesSettings() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const rules = useQuery({ queryKey: ["naming-rules"], queryFn: () => unwrap(api.GET("/api/v1/naming-rules")) });
  const [target, setTarget] = useState<Target>("file_name");
  const [regex, setRegex] = useState("");
  const [example, setExample] = useState("");
  const [message, setMessage] = useState("");
  const create = useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/naming-rules", { body: { target, regex, example, message } })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["naming-rules"] });
      toast({ title: "Rule added" });
      setRegex("");
      setExample("");
      setMessage("");
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE("/api/v1/naming-rules/{id}", { params: { path: { id } } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["naming-rules"] }),
  });
  const error = create.error instanceof ApiError ? create.error : null;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate();
  };
  const list = rules.data ?? [];

  return (
    <>
      <PageHeader title="Naming rules" meta="Uploads that break a rule are blocked from issue with the rule's message (A-04). Discipline sheet-number rules are set under Disciplines." />
      <div className="flex flex-col gap-4">
        <Card title="Rules">
          <DataState isPending={rules.isPending} error={rules.error} isEmpty={list.length === 0} onRetry={() => rules.refetch()} empty={<EmptyState message="No firm-wide naming rules yet. File names must still contain the sheet number." />}>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th scope="col" className={thClass}>Applies to</th>
                  <th scope="col" className={thClass}>Pattern</th>
                  <th scope="col" className={thClass}>Example</th>
                  <th scope="col" className={thClass}>Message</th>
                  <th scope="col" className={thClass}><span className="sr-only">Remove</span></th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id}>
                    <td className={tdClass}>{TARGETS.find((t) => t.value === r.target)?.label}</td>
                    <td className={tdClass}><code className="text-small">{r.regex}</code></td>
                    <td className={tdClass}><span className="mono">{r.example}</span></td>
                    <td className={`${tdClass} text-small`}>{r.message || "—"}</td>
                    <td className={`${tdClass} text-right`}>
                      <Button size="sm" variant="ghost" aria-label={`Remove rule ${r.regex}`} onClick={() => remove.mutate(r.id)}><Trash2 size={14} aria-hidden="true" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataState>
          <form onSubmit={submit} className="grid gap-3 border-t border-border p-4 md:grid-cols-[160px_1fr_160px_1fr_auto] md:items-end">
            <Field label="Applies to">
              {(a) => (
                <Select {...a} value={target} onChange={(e) => setTarget(e.target.value as Target)}>
                  {TARGETS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Pattern (regular expression)" error={error?.field("regex") ?? (error?.body.field === "regex" ? error.message : undefined)}>
              {(a) => <TextInput {...a} className="mono" required value={regex} onChange={(e) => setRegex(e.target.value)} placeholder="^[A-Z]-\d{3}\.pdf$" />}
            </Field>
            <Field label="Valid example">{(a) => <TextInput {...a} className="mono" required value={example} onChange={(e) => setExample(e.target.value)} placeholder="A-101.pdf" />}</Field>
            <Field label="Message shown when it fails">{(a) => <TextInput {...a} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Rename to A-101.pdf." />}</Field>
            <Button type="submit" icon={<Plus size={16} aria-hidden="true" />} busy={create.isPending} disabled={!regex || !example}>Add rule</Button>
          </form>
        </Card>
        <Tester />
      </div>
    </>
  );
}

function Tester() {
  const [target, setTarget] = useState<Target>("file_name");
  const [value, setValue] = useState("");
  const test = useMutation({ mutationFn: () => unwrap(api.POST("/api/v1/naming-rules/test", { body: { target, value } })) });
  return (
    <Card title="Try a name">
      <form
        className="flex flex-wrap items-end gap-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          test.mutate();
        }}
      >
        <Field label="Applies to" className="w-44">
          {(a) => (
            <Select {...a} value={target} onChange={(e) => setTarget(e.target.value as Target)}>
              {TARGETS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Paste a file name or sheet number" className="min-w-64 flex-1">
          {(a) => <TextInput {...a} className="mono" value={value} onChange={(e) => setValue(e.target.value)} />}
        </Field>
        <Button type="submit" busy={test.isPending} disabled={!value}>Test</Button>
      </form>
      {test.data && (
        <p role="status" className="px-4 pb-4 text-body" style={{ color: test.data.passes ? "var(--state-issued-fg)" : "var(--flag-late-fg)" }}>
          {test.data.passes ? `✓ ${value} passes every rule.` : `✗ ${test.data.problems.join(" ")}`}
        </p>
      )}
    </Card>
  );
}
