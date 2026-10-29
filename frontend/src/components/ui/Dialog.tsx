import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "./Button";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** States the action, e.g. "Delete discipline Z?" */
  title: string;
  /** Lists the consequences. */
  children: ReactNode;
  /** Repeats the verb, e.g. "Delete discipline". */
  confirmLabel: string;
  onConfirm: () => void;
  busy?: boolean;
  destructive?: boolean;
}

/** Irreversible means explicit (DESIGN.md §1.5). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  children,
  confirmLabel,
  onConfirm,
  busy,
  destructive,
}: ConfirmDialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <RadixDialog.Content className="fixed top-1/2 left-1/2 z-50 w-[440px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface p-6 shadow-overlay">
          <RadixDialog.Title className="text-title font-semibold">{title}</RadixDialog.Title>
          <RadixDialog.Description asChild>
            <div className="mt-2 text-body text-muted">{children}</div>
          </RadixDialog.Description>
          <div className="mt-6 flex justify-end gap-2">
            <RadixDialog.Close asChild>
              <Button>Cancel</Button>
            </RadixDialog.Close>
            <Button variant={destructive ? "danger" : "primary"} busy={busy} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}

/** Right-side 480 px panel for quick edits without leaving the list. */
export function Drawer({ open, onOpenChange, title, children }: DrawerProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
        <RadixDialog.Content
          aria-describedby={undefined}
          className="fixed top-0 right-0 z-50 flex h-full w-[480px] max-w-full flex-col border-l border-border bg-surface shadow-overlay"
        >
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <RadixDialog.Title className="text-title font-semibold">{title}</RadixDialog.Title>
            <RadixDialog.Close aria-label="Close" className="rounded-sm p-1 text-muted hover:bg-surface-muted">
              <X aria-hidden="true" size={18} />
            </RadixDialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
