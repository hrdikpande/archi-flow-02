import { TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

interface MetricCardProps {
  label: string;
  value: ReactNode;
  /** Change vs last week; "up is bad" for late/at-risk counts. */
  delta?: number | null;
  upIsBad?: boolean;
  /** The list behind the number (F-22: every number links to it). */
  to?: string;
  hint?: string;
}

/** Big number + label + delta vs last week + link (DESIGN.md §4). */
export function MetricCard({ label, value, delta, upIsBad = true, to, hint }: MetricCardProps) {
  const body = (
    <>
      <span className="text-small font-semibold text-muted">{label}</span>
      <span className="text-metric font-semibold tabular">{value}</span>
      {delta !== undefined && delta !== null && delta !== 0 && (
        <span className="flex items-center gap-1 text-small" style={{ color: (delta > 0) === upIsBad ? "var(--flag-late-fg)" : "var(--state-issued-fg)" }}>
          {delta > 0 ? <TrendingUp size={14} aria-hidden="true" /> : <TrendingDown size={14} aria-hidden="true" />}
          {delta > 0 ? `+${delta}` : delta} on last week
        </span>
      )}
      {delta === 0 && <span className="text-small text-muted">Same as last week</span>}
      {hint && <span className="text-small text-muted">{hint}</span>}
    </>
  );
  const cls = "flex min-w-40 flex-1 flex-col gap-1 rounded-md border border-border bg-surface px-4 py-3";
  return to ? (
    <Link to={to} className={`${cls} motion-hover hover:border-primary`}>
      {body}
      <span className="sr-only">Open the list</span>
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
