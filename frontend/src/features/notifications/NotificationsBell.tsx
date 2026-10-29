import * as Dialog from "@radix-ui/react-dialog";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { Button } from "@/components/ui/Button";
import { api, unwrap } from "@/lib/api/client";
import { cursorFrom } from "@/lib/api/cursor";
import { cn } from "@/lib/cn";
import { formatDateTime, todayISO } from "@/lib/format";

/** Top-bar bell with unread count; opens the right-hand panel (DESIGN.md §3, S-13). */
export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const unread = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => unwrap(api.GET("/api/v1/notifications", { params: { query: { unread: true, page_size: 1 } } })),
  });
  const list = useInfiniteQuery({
    queryKey: ["notifications", "all"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => unwrap(api.GET("/api/v1/notifications", { params: { query: { cursor: pageParam } } })),
    getNextPageParam: (last) => cursorFrom(last.next),
    enabled: open,
  });
  const markRead = useMutation({
    mutationFn: (ids?: string[]) => unwrap(api.POST("/api/v1/notifications/read", { body: { ids: ids ?? null } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const count = unread.data?.results.length ? (unread.data.next ? "9+" : String(unread.data.results.length)) : "";
  const items = list.data?.pages.flatMap((p) => p.results) ?? [];
  const today = todayISO();
  const groups = [
    { label: "Today", items: items.filter((n) => n.created_at.slice(0, 10) >= today) },
    { label: "Earlier", items: items.filter((n) => n.created_at.slice(0, 10) < today) },
  ];

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button type="button" className="relative rounded-sm p-1.5 text-muted hover:bg-surface-muted" aria-label={count ? `Notifications, ${count} unread` : "Notifications"}>
          <Bell size={18} aria-hidden="true" />
          {count && <span className="absolute -top-0.5 -right-0.5 rounded-full bg-primary px-1 text-[11px] leading-4 font-semibold text-on-primary">{count}</span>}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/20" />
        <Dialog.Content aria-describedby={undefined} className="fixed top-0 right-0 z-50 flex h-full w-[400px] max-w-full flex-col border-l border-border bg-surface shadow-overlay">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <Dialog.Title className="text-title font-semibold">Notifications</Dialog.Title>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={() => markRead.mutate(undefined)}>Mark all read</Button>
              <Dialog.Close aria-label="Close" className="rounded-sm p-1 text-muted hover:bg-surface-muted"><X size={18} aria-hidden="true" /></Dialog.Close>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {items.length === 0 && !list.isPending && <p className="p-4 text-body text-muted">You're all caught up.</p>}
            {groups.filter((g) => g.items.length).map((g) => (
              <section key={g.label} aria-label={g.label}>
                <h3 className="bg-surface-muted px-4 py-1 text-small font-semibold text-muted">{g.label}</h3>
                <ul>
                  {g.items.map((n) => (
                    <li key={n.id} className={cn("border-b border-border", !n.read_at && "bg-bg")}>
                      <Link
                        to={n.link || "/"}
                        onClick={() => {
                          if (!n.read_at) markRead.mutate([n.id]);
                          setOpen(false);
                        }}
                        className="block px-4 py-2 hover:bg-surface-muted"
                      >
                        <span className={cn("block text-body", !n.read_at && "font-semibold")}>{n.title}</span>
                        {n.body && <span className="block truncate text-small text-muted">{n.body}</span>}
                        <span className="text-small text-muted">{formatDateTime(n.created_at)}{!n.read_at && " · unread"}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {list.hasNextPage && <div className="p-3"><Button size="sm" onClick={() => list.fetchNextPage()}>Show more</Button></div>}
          </div>
          <div className="border-t border-border px-4 py-2 text-small">
            <Link to="/settings/notifications" className="text-primary underline" onClick={() => setOpen(false)}>Notification preferences</Link>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
