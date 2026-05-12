import { describe, expect, it } from "vitest";

import { assetStatusTone, incidentStatusTone, severityTone } from "./tones";

// Tones drive the colour treatment for every status badge in the app. These
// tests pin the mapping so an accidental rename does not silently flip a
// critical incident from "red" to "amber" in the operator's view.
describe("tones", () => {
  it("maps every severity to a tone", () => {
    expect(severityTone.info).toBe("cyan");
    expect(severityTone.low).toBe("green");
    expect(severityTone.medium).toBe("amber");
    expect(severityTone.high).toBe("red");
    expect(severityTone.critical).toBe("red");
  });

  it("paints active asset states with attention-grabbing tones", () => {
    expect(assetStatusTone.nominal).toBe("green");
    expect(assetStatusTone.watch).toBe("amber");
    expect(assetStatusTone.alert).toBe("red");
    expect(assetStatusTone.offline).toBe("neutral");
  });

  it("treats open incidents as the highest-attention state", () => {
    expect(incidentStatusTone.open).toBe("red");
    expect(incidentStatusTone.acknowledged).toBe("amber");
    expect(incidentStatusTone.resolved).toBe("green");
  });
});
