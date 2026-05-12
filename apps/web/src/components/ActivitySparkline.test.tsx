import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ActivitySparkline } from "./ActivitySparkline";

const flatActivity = {
  buckets: Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 })),
  total_24h: 0,
  peak_hour: 0
};

const peakedActivity = {
  buckets: Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: hour === 14 ? 12 : 1
  })),
  total_24h: 35,
  peak_hour: 14
};

describe("ActivitySparkline", () => {
  it("renders the 24-bucket sparkline with peak callout", () => {
    render(<ActivitySparkline activity={peakedActivity} />);
    // The peak hour is surfaced as text for screen readers / quick scanning.
    expect(screen.getByText(/peak/i)).toBeInTheDocument();
    expect(screen.getByText(/35/)).toBeInTheDocument();
  });

  it("handles an empty 24h window without crashing", () => {
    // Empty windows happen right after a fresh deploy; the chart should still
    // render — operator should not see a missing widget.
    const { container } = render(<ActivitySparkline activity={flatActivity} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});
