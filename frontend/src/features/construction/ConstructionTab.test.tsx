import { render, screen } from "@testing-library/react";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { useProjectContext } from "@/features/projects/ProjectLayout";

import { ConstructionTab } from "./ConstructionTab";

function ProjectName() {
  return <p>{useProjectContext().project.code}</p>;
}

describe("ConstructionTab", () => {
  it("passes the project context through its nested outlet", async () => {
    const project = { code: "2026-014" } as ReturnType<typeof useProjectContext>["project"];
    const router = createMemoryRouter(
      [{ path: "/p", element: <Outlet context={{ project }} />, children: [{ path: "construction", element: <ConstructionTab />, children: [{ path: "rfis", element: <ProjectName /> }] }] }],
      { initialEntries: ["/p/construction/rfis"] },
    );
    render(<RouterProvider router={router} />);
    expect(await screen.findByText("2026-014")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Construction logs" })).toBeInTheDocument();
  });
});
