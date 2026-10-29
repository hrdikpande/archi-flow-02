import { type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, useId } from "react";

import { cn } from "@/lib/cn";

const control =
  "h-9 w-full rounded-sm border border-border bg-surface px-2.5 text-body text-text placeholder:text-muted " +
  "aria-[invalid=true]:border-danger disabled:bg-surface-muted";

interface FieldProps {
  label: string;
  error?: string;
  hint?: ReactNode;
  className?: string;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => ReactNode;
}

/** Label, control, hint and error wired together for screen readers. */
export function Field({ label, error, hint, className, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={id} className="text-small font-semibold text-muted">
        {label}
      </label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {hint && (
        <p id={hintId} className="text-small text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-small text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(control, "pr-8", className)} {...props}>
      {children}
    </select>
  );
}
