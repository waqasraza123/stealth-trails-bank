import { describe, expect, it } from "vitest";
import {
  formatReferenceValue,
  formatRelativeTimeLabel,
  getTransactionConfidenceLabel,
  isTimestampOlderThan,
  mapIntentStatusToConfidence
} from "@stealth-trails-bank/ui-foundation";

describe("ui foundation helpers", () => {
  it("maps backend intent states into customer confidence states", () => {
    expect(mapIntentStatusToConfidence("requested")).toBe("submitted");
    expect(mapIntentStatusToConfidence("broadcast")).toBe("sent_to_network");
    expect(mapIntentStatusToConfidence("settled")).toBe("complete");
  });

  it("formats shared presentation labels and references", () => {
    expect(getTransactionConfidenceLabel("under_review")).toBe("Under review");
    expect(formatReferenceValue("reference_abcdefghijklmnopqrstuvwxyz", "None", 6)).toBe(
      "refere...uvwxyz"
    );
  });

  it("flags stale timestamps and formats relative update labels", () => {
    const now = Date.parse("2026-04-10T00:00:00.000Z");
    const fresh = "2026-04-09T22:30:00.000Z";
    const stale = "2026-04-08T00:00:00.000Z";

    expect(isTimestampOlderThan(fresh, 24, now)).toBe(false);
    expect(isTimestampOlderThan(stale, 24, now)).toBe(true);
    expect(formatRelativeTimeLabel(fresh, "en", now)).toBe("2h ago");
    expect(formatRelativeTimeLabel(stale, "ar", now)).toContain("منذ");
  });
});
