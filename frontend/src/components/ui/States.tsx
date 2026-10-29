import { RefreshCw, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "./Button";

/** Empty: one line + one primary action, no illustration (DESIGN.md §4). */
export function EmptyState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 px-4 py-8">
      <p className="text-body text-muted">{message}</p>
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 px-4 py-8">
      <p className="flex items-center gap-2 text-body text-danger">
        <TriangleAlert aria-hidden="true" size={16} />
        {message}
      </p>
      {onRetry && (
        <Button size="sm" icon={<RefreshCw aria-hidden="true" size={14} />} onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function PartialBanner({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="mb-3 flex items-center gap-2 rounded-sm px-3 py-2 text-small"
      style={{ color: "var(--flag-at_risk-fg)", background: "var(--flag-at_risk-bg)" }}
    >
      <TriangleAlert aria-hidden="true" size={14} />
      {message}
    </div>
  );
}

export function SkeletonRows({ rows = 5, label = "Loading" }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-2 p-4">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-5 animate-pulse rounded-sm bg-surface-muted motion-reduce:animate-none" />
      ))}
    </div>
  );
}

interface DataStateProps {
  isPending: boolean;
  error: Error | null;
  isEmpty: boolean;
  empty: ReactNode;
  onRetry?: () => void;
  partial?: string;
  loadingLabel?: string;
  children: ReactNode;
}

/** The five data states every data component needs: loading, empty, error, partial, success. */
export function DataState({
  isPending,
  error,
  isEmpty,
  empty,
  onRetry,
  partial,
  loadingLabel,
  children,
}: DataStateProps) {
  if (isPending) return <SkeletonRows label={loadingLabel} />;
  if (error) return <ErrorState message={error.message || "Could not load this."} onRetry={onRetry} />;
  if (isEmpty) return <>{empty}</>;
  return (
    <>
      {partial && <PartialBanner message={partial} />}
      {children}
    </>
  );
}
