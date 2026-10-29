import * as RadixToast from "@radix-ui/react-toast";
import { X } from "lucide-react";
import { createContext, type ReactNode, useCallback, useContext, useState } from "react";

interface ToastInput {
  title: string;
  description?: string;
  /** Undo for reversible actions (assignments, dates, imports); never for Issue. */
  onUndo?: () => void;
}

interface ToastItem extends ToastInput {
  id: number;
}

const ToastContext = createContext<(t: ToastInput) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

/** Bottom-right, 5 s, with Undo where possible. Not for errors that need action (DESIGN.md §4). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((t: ToastInput) => {
    setItems((current) => [...current, { ...t, id: Date.now() + Math.random() }]);
  }, []);
  const remove = (id: number) => setItems((current) => current.filter((i) => i.id !== id));

  return (
    <ToastContext.Provider value={push}>
      <RadixToast.Provider duration={5000} swipeDirection="right">
        {children}
        {items.map((item) => (
          <RadixToast.Root
            key={item.id}
            onOpenChange={(open) => !open && remove(item.id)}
            className="flex items-start gap-3 rounded-md border border-border bg-surface p-3 text-body text-text shadow-overlay"
          >
            <div className="flex-1">
              <RadixToast.Title className="font-semibold">{item.title}</RadixToast.Title>
              {item.description && (
                <RadixToast.Description className="text-small text-muted">{item.description}</RadixToast.Description>
              )}
            </div>
            {item.onUndo && (
              <RadixToast.Action altText="Undo" asChild>
                <button className="font-semibold text-primary" onClick={item.onUndo}>
                  Undo
                </button>
              </RadixToast.Action>
            )}
            <RadixToast.Close aria-label="Dismiss" className="text-muted">
              <X aria-hidden="true" size={16} />
            </RadixToast.Close>
          </RadixToast.Root>
        ))}
        <RadixToast.Viewport className="fixed right-4 bottom-4 z-50 flex w-[360px] max-w-[calc(100vw-32px)] flex-col gap-2 outline-none" />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}
