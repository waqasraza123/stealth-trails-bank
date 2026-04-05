export type CustomerIntentType = "deposit" | "withdrawal";

const positiveDecimalPattern = /^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/;

export function formatTokenAmount(
  value: string | null | undefined,
  maxFractionDigits = 6
): string {
  if (!value) {
    return "0";
  }

  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return "0";
  }

  const isNegative = normalizedValue.startsWith("-");
  const unsignedValue = isNegative ? normalizedValue.slice(1) : normalizedValue;
  const [wholePart, fractionPart = ""] = unsignedValue.split(".");
  const wholeNumber = wholePart.replace(/\B(?=(\d{3})+(?!\d))/g, ",") || "0";
  const trimmedFraction = fractionPart
    .slice(0, maxFractionDigits)
    .replace(/0+$/, "");
  const formattedValue = trimmedFraction
    ? `${wholeNumber}.${trimmedFraction}`
    : wholeNumber;

  return isNegative ? `-${formattedValue}` : formattedValue;
}

function normalizeDecimalForCompare(value: string) {
  const trimmedValue = value.trim();
  const isNegative = trimmedValue.startsWith("-");
  const unsignedValue = isNegative ? trimmedValue.slice(1) : trimmedValue;
  const [wholePart = "0", fractionPart = ""] = unsignedValue.split(".");

  return {
    isNegative,
    wholePart: wholePart.replace(/^0+(?=\d)/, "") || "0",
    fractionPart: fractionPart.replace(/0+$/, "")
  };
}

export function compareDecimalStrings(left: string, right: string): number {
  const normalizedLeft = normalizeDecimalForCompare(left);
  const normalizedRight = normalizeDecimalForCompare(right);

  if (normalizedLeft.isNegative !== normalizedRight.isNegative) {
    return normalizedLeft.isNegative ? -1 : 1;
  }

  const comparisonSign = normalizedLeft.isNegative ? -1 : 1;

  if (
    normalizedLeft.wholePart.length !== normalizedRight.wholePart.length
  ) {
    return normalizedLeft.wholePart.length > normalizedRight.wholePart.length
      ? comparisonSign
      : -comparisonSign;
  }

  if (normalizedLeft.wholePart !== normalizedRight.wholePart) {
    return normalizedLeft.wholePart > normalizedRight.wholePart
      ? comparisonSign
      : -comparisonSign;
  }

  const fractionalLength = Math.max(
    normalizedLeft.fractionPart.length,
    normalizedRight.fractionPart.length
  );
  const paddedLeftFraction = normalizedLeft.fractionPart.padEnd(
    fractionalLength,
    "0"
  );
  const paddedRightFraction = normalizedRight.fractionPart.padEnd(
    fractionalLength,
    "0"
  );

  if (paddedLeftFraction === paddedRightFraction) {
    return 0;
  }

  return paddedLeftFraction > paddedRightFraction
    ? comparisonSign
    : -comparisonSign;
}

export function isPositiveDecimalString(value: string): boolean {
  const trimmedValue = value.trim();

  if (!positiveDecimalPattern.test(trimmedValue)) {
    return false;
  }

  return compareDecimalStrings(trimmedValue, "0") === 1;
}

export function formatDateLabel(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

export function formatShortAddress(
  value: string | null | undefined,
  leading = 6,
  trailing = 4
): string {
  if (!value) {
    return "Not available";
  }

  if (value.length <= leading + trailing) {
    return value;
  }

  return `${value.slice(0, leading)}...${value.slice(-trailing)}`;
}

export function normalizeIntentTypeLabel(
  intentType: CustomerIntentType
): string {
  return intentType === "deposit" ? "Deposit" : "Withdrawal";
}

export function formatIntentAmount(
  amount: string,
  assetSymbol: string,
  intentType: CustomerIntentType
): string {
  const prefix = intentType === "deposit" ? "+" : "-";
  return `${prefix}${formatTokenAmount(amount)} ${assetSymbol}`;
}

export function resolveIntentAddress(input: {
  intentType: CustomerIntentType;
  externalAddress: string | null;
  destinationWalletAddress: string | null;
  sourceWalletAddress: string | null;
  latestBlockchainTransaction:
    | {
        fromAddress: string | null;
        toAddress: string | null;
      }
    | null;
}): string {
  if (input.intentType === "withdrawal") {
    return (
      input.externalAddress ??
      input.latestBlockchainTransaction?.toAddress ??
      input.sourceWalletAddress ??
      "N/A"
    );
  }

  return (
    input.destinationWalletAddress ??
    input.latestBlockchainTransaction?.toAddress ??
    "N/A"
  );
}

export function getIntentStatusBadgeTone(status: string): string {
  if (status === "settled" || status === "confirmed") {
    return "bg-mint-100 text-mint-700";
  }

  if (status === "failed" || status === "cancelled") {
    return "bg-red-100 text-red-700";
  }

  return "bg-orange-100 text-orange-700";
}

export function getIntentStatusTextTone(status: string): string {
  if (status === "settled" || status === "confirmed") {
    return "text-mint-700";
  }

  if (status === "failed" || status === "cancelled") {
    return "text-red-700";
  }

  return "text-orange-600";
}

export function isEthereumAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

export function buildRequestIdempotencyKey(prefix: string): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, "")
    .slice(0, 14);
  const randomSegment =
    globalThis.crypto?.randomUUID?.().replace(/-/g, "").slice(0, 12) ??
    `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

  return `${prefix}_${timestamp}_${randomSegment}`;
}
