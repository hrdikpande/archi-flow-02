import { useMutation, useQuery } from "@tanstack/react-query";
import { Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import { Link } from "react-router";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { api, unwrap } from "@/lib/api/client";
import { formatDate } from "@/lib/format";

import { gateText, useIntelligenceStatus } from "./api";

/** S-23 predictions panel (F-55): advisory, clearly labelled, with reasons; leads can disagree. */
export function RiskCard({ projectId }: { projectId: string }) {
  const toast = useToast();
  const status = useIntelligenceStatus();
  const risk = useQuery({ queryKey: ["projects", projectId, "risk"], queryFn: () => unwrap(api.GET("/api/v1/projects/{project_pk}/risk", { params: { path: { project_pk: projectId } } })) });
  const feedback = useMutation({
    mutationFn: ({ id, agree }: { id: string; agree: boolean }) => unwrap(api.POST("/api/v1/predictions/{id}/feedback", { params: { path: { id } }, body: { agree } })),
    onSuccess: () => toast({ title: "Thanks: recorded for the monthly evaluation" }),
  });
  const rows = (risk.data ?? []).slice(0, 8);
  return (
    <Card title="Forecast: sheets likely to be late">
      <div className="flex flex-col gap-2 p-4">
        <p className="flex items-center gap-1.5 text-small text-muted"><Sparkles size={14} aria-hidden="true" /> Advisory only. It never changes dates or assignments.</p>
        {rows.length === 0 ? (
          <p className="text-body text-muted">{status.data && !status.data.gate.met ? gateText(status.data.gate) : "No forecast for this project this week."}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((p) => (
              <li key={p.id} className="flex items-start justify-between gap-2 rounded-sm border border-border p-2">
                <div>
                  <Link to={`sheets/${p.sheet}`} className="hover:underline"><span className="mono font-semibold">{p.sheet_number}</span> {p.sheet_title}</Link>
                  <p className="text-small text-muted">{Math.round(p.score * 100)}% chance of missing {formatDate(p.planned_date)}{p.reasons.length > 0 && `: ${p.reasons.map((r) => r.text).join("; ")}`}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" variant="ghost" aria-label={`Agree with the forecast for ${p.sheet_number}`} icon={<ThumbsUp size={14} aria-hidden="true" />} onClick={() => feedback.mutate({ id: p.id, agree: true })} />
                  <Button size="sm" variant="ghost" aria-label={`Disagree with the forecast for ${p.sheet_number}`} icon={<ThumbsDown size={14} aria-hidden="true" />} onClick={() => feedback.mutate({ id: p.id, agree: false })} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
