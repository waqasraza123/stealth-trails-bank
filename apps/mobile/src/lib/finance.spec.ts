import {
  buildRequestIdempotencyKey,
  compareDecimalStrings,
  formatShortAddress,
  formatIntentStatusLabel,
  getIntentStatusTone,
  isEthereumAddress,
  isPositiveDecimalString
} from "./finance";

describe("finance helpers", () => {
  it("compares decimal strings without losing precision", () => {
    expect(compareDecimalStrings("10.0000001", "10")).toBe(1);
    expect(compareDecimalStrings("001.20", "1.2")).toBe(0);
    expect(compareDecimalStrings("0.009", "0.010")).toBe(-1);
  });

  it("validates positive decimal strings", () => {
    expect(isPositiveDecimalString("1")).toBe(true);
    expect(isPositiveDecimalString("0.0001")).toBe(true);
    expect(isPositiveDecimalString("0")).toBe(false);
    expect(isPositiveDecimalString("-1")).toBe(false);
    expect(isPositiveDecimalString("1.1234567890123456789")).toBe(false);
  });

  it("validates ethereum addresses", () => {
    expect(isEthereumAddress("0x1111111111111111111111111111111111111111")).toBe(
      true
    );
    expect(isEthereumAddress("0x1234")).toBe(false);
  });

  it("formats short addresses safely", () => {
    expect(
      formatShortAddress("0x1111111111111111111111111111111111111111", "N/A", 6, 4)
    ).toBe("0x1111...1111");
    expect(formatShortAddress(null, "N/A")).toBe("N/A");
  });

  it("maps intent statuses to localized labels and tones", () => {
    expect(formatIntentStatusLabel("settled", "en")).toBe("Complete");
    expect(getIntentStatusTone("failed")).toBe("critical");
  });

  it("creates prefixed idempotency keys", () => {
    const key = buildRequestIdempotencyKey("deposit_req");

    expect(key).toMatch(/^deposit_req_\d{14}_[a-z0-9]+$/i);
  });
});
