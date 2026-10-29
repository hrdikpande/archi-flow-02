import type { ReactNode } from "react";

export function PageHeader({ title, meta, actions }: { title: string; meta?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-display font-semibold">{title}</h1>
        {meta && <p className="mt-1 text-small text-muted">{meta}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Card({ title, actions, children }: { title?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-md border border-border bg-surface">
      {(title || actions) && (
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          {title && <h2 className="text-title font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

/** Real <table> semantics (DESIGN.md §8); compact 36 px rows. */
export const tableClass = "w-full border-collapse text-left text-body";
export const thClass =
  "sticky top-0 bg-surface-muted px-3 py-2 text-small font-semibold text-muted border-b border-border";
export const tdClass = "h-9 px-3 py-1.5 border-b border-border align-middle";
