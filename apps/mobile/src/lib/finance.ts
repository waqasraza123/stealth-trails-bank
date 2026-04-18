import {
  formatDateLabel as formatLocalizedDateLabel,
  formatDecimalString,
  type SupportedLocale
} from "@stealth-trails-bank/i18n";
import {
  buildIntentTimeline as buildSharedIntentTimeline,
  getTransactionConfidenceLabel,
  getTransactionConfidenceTone,
  mapIntentStatusToConfidence,
  type TimelineEvent,
  type TransactionConfidenceStatus
} from "@stealth-trails-bank/ui-foundation";

export type CustomerIntentType = "deposit" | "withdrawal";

const positiveDecimalPattern = /^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/;
const positiveIntegerPattern = /^[1-9]\d*$/;

export function formatTokenAmount(
  value: string | null | undefined,
  locale: SupportedLocale = "en",
  maxFractionDigits = 6
): string {
  return formatDecimalString(value, locale, maxFractionDigits);
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

  if (normalizedLeft.wholePart.length !== normalizedRight.wholePart.length) {
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

export function isPositiveIntegerString(value: string): boolean {
  return positiveIntegerPattern.test(value.trim());
}

export function formatDateLabel(
  value: string,
  locale: SupportedLocale = "en"
): string {
  return formatLocalizedDateLabel(value, locale);
}

export function formatShortAddress(
  value: string | null | undefined,
  unavailableLabel = "Not available",
  leading = 6,
  trailing = 4
): string {
  if (!value) {
    return unavailableLabel;
  }

  if (value.length <= leading + trailing) {
    return value;
  }

  return `${value.slice(0, leading)}...${value.slice(-trailing)}`;
}

export function normalizeIntentTypeLabel(
  intentType: CustomerIntentType,
  locale: SupportedLocale = "en"
): string {
  if (locale === "ar") {
    return intentType === "deposit" ? "إيداع" : "سحب";
  }

  return intentType === "deposit" ? "Deposit" : "Withdrawal";
}

export function formatIntentAmount(
  amount: string,
  assetSymbol: string,
  intentType: CustomerIntentType,
  locale: SupportedLocale = "en"
): string {
  const prefix = intentType === "deposit" ? "+" : "-";
  return `${prefix}${formatTokenAmount(amount, locale)} ${assetSymbol}`;
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

export function formatIntentStatusLabel(
  status: string,
  locale: SupportedLocale = "en"
): string {
  return getTransactionConfidenceLabel(
    mapIntentStatusToConfidence(status),
    locale
  );
}

export function getIntentConfidenceStatus(
  status: string
): TransactionConfidenceStatus {
  return mapIntentStatusToConfidence(status);
}

export function getIntentStatusTone(status: string) {
  return getTransactionConfidenceTone(mapIntentStatusToConfidence(status));
}

export function buildIntentTimeline(input: {
  id: string;
  status: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  latestBlockchainTransaction?: {
    txHash: string | null;
  } | null;
}): TimelineEvent[] {
  return buildSharedIntentTimeline({
    id: input.id,
    status: input.status,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    txHash: input.latestBlockchainTransaction?.txHash ?? null
  });
}

export function isEthereumAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

export function buildRequestIdempotencyKey(prefix: string): string {
  const now = new Date();
  const timestamp = [
    now.getUTCFullYear().toString(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
    String(now.getUTCHours()).padStart(2, "0"),
    String(now.getUTCMinutes()).padStart(2, "0"),
    String(now.getUTCSeconds()).padStart(2, "0")
  ].join("");
  const randomSegment =
    globalThis.crypto?.randomUUID?.().replace(/-/g, "").slice(0, 12) ??
    `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

  return `${prefix}_${timestamp}_${randomSegment}`;
}
