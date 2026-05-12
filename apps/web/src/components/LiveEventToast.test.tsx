import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LiveEventMessage } from "../lib/api";
import { LiveEventToast } from "./LiveEventToast";

function makeEvent(overrides: Partial<LiveEventMessage["event"]> = {}): LiveEventMessage {
  return {
    message_type: "event.created",
    event: {
      id: "evt-1",
      asset_id: "asset-1",
      asset_name: "Patrol Team Alpha",
      event_type: "geofence_breach",
      severity: "high",
      source: "Personnel Tracker",
      zone: "Perimeter West",
      message: "Patrol crossed a restricted boundary.",
      occurred_at: "2026-05-12T12:00:00Z",
      metadata: {},
      ...overrides
    },
    asset: {
      id: "asset-1",
      name: "Patrol Team Alpha",
      call_sign: "ALPHA-1",
      asset_type: "personnel",
      status: "watch",
      zone: "Perimeter West",
      latitude: 0,
      longitude: 0,
      battery_level: 80,
      last_seen_at: "2026-05-12T12:00:00Z",
      metadata: {}
    },
    incident: null,
    emitted_at: "2026-05-12T12:00:00Z"
  };
}

describe("LiveEventToast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing when there is no event", () => {
    const { container } = render(<LiveEventToast latestEvent={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the event message when a high-severity event arrives", () => {
    render(<LiveEventToast latestEvent={makeEvent()} />);
    expect(screen.getByText(/restricted boundary/i)).toBeInTheDocument();
    expect(screen.getByText("Live Event")).toBeInTheDocument();
  });

  it("calls out a linked incident when present", () => {
    const event = makeEvent();
    event.incident = {
      id: "inc-1",
      title: "Perimeter West live anomaly",
      summary: "",
      severity: "high",
      status: "open",
      explanation: "",
      created_at: "2026-05-12T12:00:00Z",
      updated_at: "2026-05-12T12:00:00Z",
      related_event_ids: []
    };
    render(<LiveEventToast latestEvent={event} />);
    expect(screen.getByText(/Perimeter West live anomaly/i)).toBeInTheDocument();
  });

  it("can be dismissed manually", () => {
    render(<LiveEventToast latestEvent={makeEvent()} />);
    expect(screen.getByText(/restricted boundary/i)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/dismiss notification/i));
    expect(screen.queryByText(/restricted boundary/i)).not.toBeInTheDocument();
  });
});
