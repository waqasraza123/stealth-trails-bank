import {
  formatDuration,
  formatName,
  shortenValue,
  toTitleCase,
  trimToUndefined
} from "../lib/format";

describe("admin format helpers", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("uses locale-aware fallbacks for empty values", () => {
    expect(formatDuration(0)).toBe("Open");
    expect(formatName(null, null)).toBe("Unnamed subject");
    expect(shortenValue(null)).toBe("Not available");
    expect(toTitleCase(null)).toBe("Unknown");
  });

  it("uses Arabic fallbacks when the admin locale is Arabic", () => {
    window.localStorage.setItem("stealth-trails-bank.admin.locale", "ar");

    expect(formatDuration(0)).toBe("مفتوح");
    expect(formatName(null, null)).toBe("عنصر غير مسمى");
    expect(shortenValue(null)).toBe("غير متاح");
    expect(toTitleCase(null)).toBe("غير معروف");
  });

  it("normalizes common formatting helpers deterministically", () => {
    expect(formatDuration(24 * 60 * 60 * 1000 + 65 * 60 * 1000)).toBe("1d 1h 5m");
    expect(formatName("Amina", "Rahman")).toBe("Amina Rahman");
    expect(shortenValue("0x1234567890abcdef", 4)).toBe("0x12...cdef");
    expect(toTitleCase("risk_manager")).toBe("Risk Manager");
    expect(trimToUndefined("   ")).toBeUndefined();
    expect(trimToUndefined(" ops_1 ")).toBe("ops_1");
  });
});
