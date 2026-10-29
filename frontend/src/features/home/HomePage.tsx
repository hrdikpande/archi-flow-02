import { Link } from "react-router";

import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/States";

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Page not found" />
      <EmptyState message="This page does not exist or you do not have access to it." action={<Link className="text-primary underline" to="/">Go home</Link>} />
    </>
  );
}
