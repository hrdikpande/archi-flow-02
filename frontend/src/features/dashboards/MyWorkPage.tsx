import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";

import { Button } from "@/components/ui/Button";
import { Card, PageHeader, tableClass, tdClass } from "@/components/ui/PageHeader";
import { DataState, EmptyState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { isoWeek } from "@/features/people/api";
import { api, unwrap } from "@/lib/api/client";
import type { Me } from "@/lib/auth/useMe";
import { formatDate, formatDateTime, todayISO } from "@/lib/format";

import { type MyWork, useMyWork } from "./api";
import { SheetLink, sheetPath, SheetStatus } from "./SheetRow";

const TIMESHEET_STATE: Record<string, string> = {
  draft: "Not submitted",
  submitted: "Submitted",
  approved: "Approved",
  returned: "Returned for correction",
};

/** S-02 My work (D-04, F-23): my sheets by due date, returned sheets, my reviews, hours. */
export function MyWorkPage({ me }: { me: Me }) {
  const work = useMyWork();
  const today = todayISO();
  return (
    <>
      <PageHeader title="My work" meta={`Welcome, ${me.short_name} · Week ${isoWeek(today)} · ${formatDate(today)}`} />
      <DataState isPending={work.isPending} error={work.error} isEmpty={false} empty={null} onRetry={() => work.refetch()}>
        {work.data && <MyWorkBody me={me} data={work.data} />}
      </DataState>
    </>
  );
}

function MyWorkBody({ me, data }: { me: Me; data: MyWork }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const run = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      unwrap(api.POST("/api/v1/sheets/{id}/transitions", { params: { path: { id } }, body: { action } })),
    onSuccess: (s, v) => {
      queryClient.invalidateQueries({ queryKey: ["dashboards", "me"] });
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
      toast({ title: `${s.number}: ${data.due.find((d) => d.sheet.id === v.id)?.next_action?.label ?? "done"}` });
    },
    onError: (e) => toast({ title: "Not possible", description: e.message }),
  });
  const ts = data.timesheet;
  const logged = Number(ts.logged_h);
  const capacity = Number(ts.capacity_h) || 1;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="flex flex-col gap-4">
        <Card title={`Due soon · ${data.due.length}`}>
          {data.due.length === 0 ? (
            <EmptyState message="No sheets are assigned to you right now." />
          ) : (
            <table className={tableClass}>
              <caption className="sr-only">Your sheets by planned issue date</caption>
              <tbody>
                {data.due.map(({ sheet, next_action }) => (
                  <tr key={sheet.id}>
                    <td className={tdClass}><SheetLink sheet={sheet} showProject /></td>
                    <td className={tdClass}><SheetStatus sheet={sheet} /></td>
                    <td className={`${tdClass} text-small tabular whitespace-nowrap`}>{sheet.planned_issue_date ? formatDate(sheet.planned_issue_date) : "No date"}</td>
                    <td className={`${tdClass} text-right`}>
                      {next_action && (next_action.needs_reason || next_action.action === "issue" || next_action.action === "return" ? (
                        <Link to={sheetPath(sheet)} className="text-small text-primary underline">{next_action.label}…</Link>
                      ) : (
                        <Button size="sm" variant={next_action.primary ? "primary" : "secondary"} busy={run.isPending && run.variables?.id === sheet.id} onClick={() => run.mutate({ id: sheet.id, action: next_action.action })}>
                          {next_action.label}
                        </Button>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card title={`Returned to you · ${data.returned.length}`}>
          {data.returned.length === 0 ? (
            <EmptyState message="Nothing has been returned with comments." />
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {data.returned.map((r) => (
                <li key={r.sheet.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                  <span><SheetLink sheet={r.sheet} showProject /></span>
                  <span className="text-small text-muted">
                    by {r.by ?? "—"} · {formatDateTime(r.at)}{r.reason && <> · “{r.reason}”</>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <div className="flex flex-col gap-4">
        {data.logs_hours && (
          <Card title="Hours this week">
            <div className="flex flex-col gap-2 p-4">
              <p className="text-title font-semibold tabular">{ts.logged_h} / {ts.capacity_h} h</p>
              <div className="h-2 w-full rounded-full bg-surface-muted" role="progressbar" aria-label="Hours logged this week" aria-valuemin={0} aria-valuemax={capacity} aria-valuenow={logged}>
                <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(100, (logged / capacity) * 100)}%` }} />
              </div>
              <p className="text-small text-muted">Planned {ts.planned_h} h · last week: {TIMESHEET_STATE[ts.last_week_state] ?? ts.last_week_state}</p>
              <Link to="/timesheets" className="text-small text-primary underline">Open timesheet</Link>
            </div>
          </Card>
        )}
        <Card title="Waiting for your check">
          <div className="flex flex-col gap-1 p-4">
            <p className="text-body">
              {data.reviews_waiting === 0 ? "Nothing waiting." : `${data.reviews_waiting} sheet${data.reviews_waiting === 1 ? "" : "s"} · oldest ${data.oldest_review_days ?? 0} d`}
            </p>
            {data.reviews_waiting > 0 && <Link to="/reviews" className="text-small text-primary underline">Open reviews</Link>}
          </div>
        </Card>
        {data.led_disciplines.length > 0 && (
          <Card title="Your disciplines">
            <ul className="flex flex-col gap-1 p-4">
              {data.led_disciplines.map((d) => (
                <li key={d.id}><Link to={`/disciplines/${d.code}`} className="text-primary underline">{d.code} · {d.name}</Link></li>
              ))}
            </ul>
          </Card>
        )}
        {me.memberships.length === 0 && <EmptyState message="You are not on any project yet. A project lead adds you to their team." />}
        {me.capabilities.manage_org_settings && (
          <Card title="Set up your firm">
            <ul className="flex flex-col gap-2 p-4 text-body">
              <li><Link className="text-primary underline" to="/admin/disciplines">Disciplines and sheet-number prefixes</Link></li>
              <li><Link className="text-primary underline" to="/admin/calendar">Working week and holidays</Link></li>
              <li><Link className="text-primary underline" to="/admin/onboarding">Load a live project (onboarding)</Link></li>
              <li><Link className="text-primary underline" to="/admin/users">Users and roles</Link></li>
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
