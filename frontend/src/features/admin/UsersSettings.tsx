import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { Card, PageHeader, tableClass, tdClass, thClass } from "@/components/ui/PageHeader";
import { DataState, EmptyState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, type Schemas, unwrap } from "@/lib/api/client";
import { cursorFrom } from "@/lib/api/cursor";
import { formatDate } from "@/lib/format";

type User = Schemas["User"];
type Role = NonNullable<User["org_role"]>;

const ROLES: { value: Role; label: string }[] = [
  { value: "owner", label: "Owner / Principal" },
  { value: "staff", label: "Staff" },
  { value: "accounts", label: "Accounts" },
  { value: "admin", label: "System admin" },
];

/** S-14 Users and roles. SSO users appear on first sign-in with no project access (F-40). */
export function UsersSettings() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const query = useInfiniteQuery({
    queryKey: ["users"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => unwrap(api.GET("/api/v1/users", { params: { query: { cursor: pageParam } } })),
    getNextPageParam: (last) => cursorFrom(last.next),
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Schemas["PatchedUserRequest"] }) =>
      unwrap(api.PATCH("/api/v1/users/{id}", { params: { path: { id } }, body })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
    onError: (error) => toast({ title: "Not changed", description: error instanceof ApiError ? error.message : undefined }),
  });

  const change = (user: User, body: Schemas["PatchedUserRequest"], message: string) => {
    const undo = { org_role: user.org_role, is_active: user.is_active, can_lead_projects: user.can_lead_projects };
    update.mutate(
      { id: user.id, body },
      { onSuccess: () => toast({ title: message, onUndo: () => update.mutate({ id: user.id, body: undo }) }) },
    );
  };

  const users = query.data?.pages.flatMap((p) => p.results) ?? [];
  return (
    <>
      <PageHeader title="Users and roles" meta="People sign in with the firm's single sign-on. Project roles are set on each project's team." />
      <Card>
        <DataState
          isPending={query.isPending}
          error={query.error}
          isEmpty={users.length === 0}
          onRetry={() => query.refetch()}
          empty={<EmptyState message="No users yet." />}
        >
          <table className={tableClass}>
            <thead>
              <tr>
                <th scope="col" className={thClass}>Name</th>
                <th scope="col" className={thClass}>Email</th>
                <th scope="col" className={thClass}>Organisation role</th>
                <th scope="col" className={thClass}>Can lead projects</th>
                <th scope="col" className={thClass}>Last sign-in</th>
                <th scope="col" className={thClass}>Access</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={u.is_active === false ? "text-muted" : undefined}>
                  <td className={tdClass}>{u.full_name || u.short_name}</td>
                  <td className={tdClass}>{u.email}</td>
                  <td className={tdClass}>
                    <Select
                      aria-label={`Role for ${u.email}`}
                      className="h-8 w-48"
                      value={u.org_role}
                      onChange={(e) =>
                        change(u, { org_role: e.target.value as Role }, `${u.short_name} is now ${ROLES.find((r) => r.value === e.target.value)?.label}`)
                      }
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </Select>
                  </td>
                  <td className={tdClass}>
                    <input
                      type="checkbox"
                      aria-label={`${u.short_name} can create and lead projects`}
                      checked={!!u.can_lead_projects}
                      onChange={(e) => change(u, { can_lead_projects: e.target.checked }, e.target.checked ? `${u.short_name} can lead projects` : `${u.short_name} can no longer create projects`)}
                    />
                  </td>
                  <td className={tdClass}>{u.last_login ? formatDate(u.last_login) : "Never"}</td>
                  <td className={tdClass}>
                    <Button
                      size="sm"
                      variant={u.is_active === false ? "secondary" : "ghost"}
                      onClick={() =>
                        change(u, { is_active: !u.is_active }, u.is_active ? `${u.short_name} can no longer sign in` : `${u.short_name} can sign in again`)
                      }
                    >
                      {u.is_active === false ? "Restore access" : "Remove access"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {query.hasNextPage && (
            <div className="p-3">
              <Button size="sm" busy={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>Show more</Button>
            </div>
          )}
        </DataState>
      </Card>
    </>
  );
}
