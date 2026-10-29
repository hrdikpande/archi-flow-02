import { useState } from "react";
import { Link } from "react-router";

import { Button } from "@/components/ui/Button";
import { Field, Select } from "@/components/ui/Field";
import { Card } from "@/components/ui/PageHeader";
import { DataState, EmptyState } from "@/components/ui/States";
import { useActivity } from "@/features/dashboards/api";
import { formatDateTime } from "@/lib/format";

import { useDisciplines, useMembers } from "./api";
import { useProjectContext } from "./ProjectLayout";

const TYPES: Record<string, string> = {
  state: "Sheet state changes",
  revision: "Revisions and redlines",
  transmittal: "Transmittals",
  stage: "Stage changes",
  import: "Imports",
  team: "Team changes",
  sheet: "Sheets added or removed",
};

/** F-45 project activity feed: newest first, each event links to its object. */
export function ActivityTab() {
  const { project } = useProjectContext();
  const members = useMembers(project.id);
  const disciplines = useDisciplines();
  const [actor, setActor] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [type, setType] = useState("");
  const feed = useActivity(project.id, { actor: actor || undefined, discipline: discipline || undefined, type: type ? [type] : undefined });
  const items = feed.data?.pages.flatMap((p) => p.results) ?? [];
  const people = [...new Map((members.data ?? []).map((m) => [m.user.id, m.user])).values()];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Person" className="w-52">
          {(p) => (
            <Select {...p} value={actor} onChange={(e) => setActor(e.target.value)}>
              <option value="">Everyone</option>
              {people.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Discipline" className="w-52">
          {(p) => (
            <Select {...p} value={discipline} onChange={(e) => setDiscipline(e.target.value)}>
              <option value="">All disciplines</option>
              {disciplines.data?.map((d) => <option key={d.id} value={d.id}>{d.code} · {d.name}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Event type" className="w-56">
          {(p) => (
            <Select {...p} value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">All events</option>
              {Object.entries(TYPES).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </Select>
          )}
        </Field>
      </div>
      <Card>
        <DataState isPending={feed.isPending} error={feed.error} isEmpty={items.length === 0} onRetry={() => feed.refetch()} empty={<EmptyState message="No activity matches these filters." />}>
          <ol className="flex flex-col divide-y divide-border" aria-label="Project activity, newest first">
            {items.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2">
                <Link to={e.link} className="text-body hover:underline">{e.text}</Link>
                <time className="text-small text-muted tabular" dateTime={e.at}>{formatDateTime(e.at)}</time>
              </li>
            ))}
          </ol>
          {feed.hasNextPage && (
            <div className="border-t border-border p-3 text-center">
              <Button size="sm" busy={feed.isFetchingNextPage} onClick={() => feed.fetchNextPage()}>Show older</Button>
            </div>
          )}
        </DataState>
      </Card>
    </div>
  );
}
