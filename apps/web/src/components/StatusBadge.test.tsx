import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it("renders the value text", () => {
    render(<StatusBadge value="open" tone="red" />);
    expect(screen.getByText("open")).toBeInTheDocument();
  });

  it("normalises snake_case for human display", () => {
    // Backend enums arrive as snake_case (e.g. access_denied); the badge
    // surfaces them as readable labels without losing the underlying value.
    render(<StatusBadge value="access_denied" tone="red" />);
    expect(screen.getByText("access denied")).toBeInTheDocument();
  });

  it("falls back to the neutral tone when none is provided", () => {
    render(<StatusBadge value="idle" />);
    const badge = screen.getByText("idle");
    // Neutral tone uses slate; just assert the class survives the render.
    expect(badge.className).toMatch(/slate/);
  });
});
