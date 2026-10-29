import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";

import { ErrorState, SkeletonRows } from "@/components/ui/States";
import { type Me, useMe } from "@/lib/auth/useMe";

/** Signed-in members only; admins who signed in with a password must finish TOTP setup. */
export function RequireAuth({ children }: { children: (me: Me) => ReactNode }) {
  const { data: me, isPending, error, refetch } = useMe();
  const location = useLocation();
  if (isPending) return <SkeletonRows label="Loading DrawingOps" />;
  if (error) return <ErrorState message="DrawingOps could not load. Check your connection." onRetry={() => refetch()} />;
  if (!me) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/sign-in?next=${next}`} replace />;
  }
  if (me.mfa.setup_required && location.pathname !== "/setup-2fa") {
    return <Navigate to="/setup-2fa" replace />;
  }
  return <>{children(me)}</>;
}
