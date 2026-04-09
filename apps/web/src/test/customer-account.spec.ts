import { describe, expect, it } from "vitest";
import {
  formatAccountStatusLabel,
  getAccountLifecycleEntries,
  getAccountStatusBadgeTone,
  getAccountStatusSummary
} from "@/lib/customer-account";

describe("customer-account helpers", () => {
  it("formats account status labels and summaries in both locales", () => {
    expect(formatAccountStatusLabel("active")).toBe("Active");
    expect(formatAccountStatusLabel("restricted", "ar")).toBe("مقيد");
    expect(formatAccountStatusLabel(null, "ar")).toBe("غير مهيأ");

    expect(getAccountStatusSummary("active")).toMatch(/active/i);
    expect(getAccountStatusSummary("frozen", "ar")).toMatch(/مجمّد/);
    expect(getAccountStatusSummary(undefined)).toMatch(/not been provisioned/i);
  });

  it("maps account status tones into safe badge variants", () => {
    expect(getAccountStatusBadgeTone("active")).toMatch(/mint/i);
    expect(getAccountStatusBadgeTone("review_required")).toMatch(/orange/i);
    expect(getAccountStatusBadgeTone("restricted")).toMatch(/red/i);
    expect(getAccountStatusBadgeTone(null)).toMatch(/slate/i);
  });

  it("builds lifecycle entries and omits empty timestamps", () => {
    expect(
      getAccountLifecycleEntries(
        {
          activatedAt: "2026-04-01T10:00:00.000Z",
          restrictedAt: null,
          frozenAt: "2026-04-02T10:00:00.000Z",
          closedAt: null
        },
        "ar"
      )
    ).toEqual([
      {
        label: "تم التفعيل",
        value: "2026-04-01T10:00:00.000Z"
      },
      {
        label: "تم التجميد",
        value: "2026-04-02T10:00:00.000Z"
      }
    ]);
  });
});
