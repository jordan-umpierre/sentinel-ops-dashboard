import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatRelativeTime } from "./date";

describe("formatRelativeTime", () => {
  const fixedNow = new Date("2026-05-12T12:00:00Z").getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns minutes for short intervals", () => {
    const fiveMinAgo = new Date(fixedNow - 5 * 60 * 1000).toISOString();
    expect(formatRelativeTime(fiveMinAgo)).toMatch(/minute/);
  });

  it("returns hours for longer intervals", () => {
    const twoHoursAgo = new Date(fixedNow - 2 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(twoHoursAgo)).toMatch(/hour/);
  });

  it("returns days when timestamps are further in the past", () => {
    const threeDaysAgo = new Date(fixedNow - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(threeDaysAgo)).toMatch(/day/);
  });
});
