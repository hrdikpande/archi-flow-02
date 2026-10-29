import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FlagPill } from "./FlagPill";
import { DataState, EmptyState } from "./States";
import { SHEET_STATES, type SheetState } from "./status";
import { StatusChip } from "./StatusChip";

describe("StatusChip", () => {
  it.each(Object.keys(SHEET_STATES) as SheetState[])("shows icon + word for %s", (state) => {
    const { container } = render(<StatusChip state={state} />);
    expect(screen.getByText(SHEET_STATES[state].label)).toBeInTheDocument();
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(container.textContent).toContain(`State: ${SHEET_STATES[state].label}`);
  });

  it("appends the revision in mono for issued sheets only", () => {
    render(<StatusChip state="issued" revision="C02" />);
    expect(screen.getByText("C02")).toHaveClass("mono");
    render(<StatusChip state="in_check" revision="P02" />);
    expect(screen.queryByText("P02")).not.toBeInTheDocument();
  });

  it("strikes through superseded", () => {
    render(<StatusChip state="superseded" />);
    expect(screen.getByText("Superseded")).toHaveClass("line-through");
  });
});

describe("FlagPill", () => {
  it("announces the flag kind to screen readers", () => {
    const { container } = render(<FlagPill kind="late" text="Late 3 days" />);
    expect(container.textContent).toBe("Flag: Late. Late 3 days");
  });
});

describe("DataState: the five data states", () => {
  const base = { isPending: false, error: null, isEmpty: false, empty: <EmptyState message="Nothing yet." /> };

  it("loading", () => {
    render(<DataState {...base} isPending loadingLabel="Loading sheets"><p>rows</p></DataState>);
    expect(screen.getByRole("status", { name: "Loading sheets" })).toBeInTheDocument();
  });

  it("empty", () => {
    render(<DataState {...base} isEmpty><p>rows</p></DataState>);
    expect(screen.getByText("Nothing yet.")).toBeInTheDocument();
  });

  it("error with retry", async () => {
    const retry = vi.fn();
    render(<DataState {...base} error={new Error("Server unavailable")} onRetry={retry}><p>rows</p></DataState>);
    expect(screen.getByRole("alert")).toHaveTextContent("Server unavailable");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("partial shows a banner and the data", () => {
    render(<DataState {...base} partial="Flags could not load."><p>rows</p></DataState>);
    expect(screen.getByRole("status")).toHaveTextContent("Flags could not load.");
    expect(screen.getByText("rows")).toBeInTheDocument();
  });

  it("success", () => {
    render(<DataState {...base}><p>rows</p></DataState>);
    expect(screen.getByText("rows")).toBeInTheDocument();
  });
});
