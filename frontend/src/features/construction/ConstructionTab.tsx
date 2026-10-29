import { Outlet } from "react-router";

import { SubNav } from "@/components/ui/SubNav";
import { useProjectContext } from "@/features/projects/ProjectLayout";

/** Project › Construction (P3): RFIs, submittals, site reports, changes, clashes (DESIGN.md §3). */
export function ConstructionTab() {
  // A nested Outlet starts a fresh outlet context, so pass the project down to the logs.
  const context = useProjectContext();
  return (
    <>
      <SubNav
        label="Construction logs"
        items={[
          { to: "rfis", label: "RFIs" },
          { to: "submittals", label: "Submittals" },
          { to: "site", label: "Site reports" },
          { to: "changes", label: "Change orders" },
          { to: "clashes", label: "Clashes" },
        ]}
      />
      <Outlet context={context} />
    </>
  );
}
