import {
  loadDatabaseRuntimeConfig,
  loadProductChainRuntimeConfig
} from "@stealth-trails-bank/config/api";
import { createStealthTrailsPrismaClient } from "@stealth-trails-bank/db";
import {
  isWalletProjectionActionable,
  isWalletProjectionAutoRepairable,
  mapWalletProjectionSurfaceToManualReviewCase,
  mapWalletProjectionSurfaceToRepairCommand,
  type LegacyUserRecord,
  type WalletProjectionAddressSource,
  type WalletProjectionSurface,
  resolveWalletProjectionResolution
} from "./lib/wallet-projection-migration";

type ScriptOptions = {
  email?: string;
  limit?: number;
  onlyActionable: boolean;
  summaryOnly: boolean;
};

type CoverageRecord = {
  legacyUserId: number;
  email: string;
  supabaseUserId: string;
  productChainId: number;
  status: WalletProjectionSurface;
  addressSource: WalletProjectionAddressSource;
  repairCommand:
    | "repair:missing-customer-projections"
    | "repair:customer-account-wallet-projections"
    | "repair:customer-wallet-projections"
    | null;
  manualReviewCase:
    | "missing_wallet_address"
    | "invalid_wallet_address"
    | "conflicting_customer_records"
    | "wallet_linked_to_other_account"
    | "wallet_legacy_mismatch"
    | "multiple_product_chain_wallets"
    | null;
  legacyEthereumAddress: string | null;
  walletAddresses: string[];
  customerId: string | null;
  customerAccountId: string | null;
  linkedCustomerAccountId: string | null;
  reason: string;
};

type CoverageSummary = {
  productChainId: number;
  scanned: number;
  walletProjected: number;
  repairMissingCustomerProjection: number;
  repairMissingCustomerAccount: number;
  repairWalletOnly: number;
  manualReviewMissingWalletAddress: number;
  manualReviewInvalidWalletAddress: number;
  manualReviewConflictingCustomerRecords: number;
  manualReviewWalletLinkedToOtherAccount: number;
  manualReviewWalletLegacyMismatch: number;
  manualReviewMultipleProductChainWallets: number;
  autoRepairableProfiles: number;
  manualReviewProfiles: number;
  walletSourceProfiles: number;
  legacySourceProfiles: number;
  noAddressProfiles: number;
  conflictSourceProfiles: number;
};

function parseOptions(argv: string[]): ScriptOptions {
  let email: string | undefined;
  let limit: number | undefined;
  let onlyActionable = false;
  let summaryOnly = false;

  for (const argument of argv) {
    if (argument === "--only-actionable") {
      onlyActionable = true;
      continue;
    }

    if (argument === "--summary-only") {
      summaryOnly = true;
      continue;
    }

    if (argument.startsWith("--email=")) {
      const emailValue = argument.slice("--email=".length).trim();

      if (!emailValue) {
        throw new Error("The --email option requires a non-empty value.");
      }

      email = emailValue;
      continue;
    }

    if (argument.startsWith("--limit=")) {
      const rawLimit = argument.slice("--limit=".length).trim();
      const parsedLimit = Number(rawLimit);

      if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
        throw new Error("The --limit option must be a positive integer.");
      }

      limit = parsedLimit;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return {
    email,
    limit,
    onlyActionable,
    summaryOnly
  };
}

function createSummary(productChainId: number): CoverageSummary {
  return {
    productChainId,
    scanned: 0,
    walletProjected: 0,
    repairMissingCustomerProjection: 0,
    repairMissingCustomerAccount: 0,
    repairWalletOnly: 0,
    manualReviewMissingWalletAddress: 0,
    manualReviewInvalidWalletAddress: 0,
    manualReviewConflictingCustomerRecords: 0,
    manualReviewWalletLinkedToOtherAccount: 0,
    manualReviewWalletLegacyMismatch: 0,
    manualReviewMultipleProductChainWallets: 0,
    autoRepairableProfiles: 0,
    manualReviewProfiles: 0,
    walletSourceProfiles: 0,
    legacySourceProfiles: 0,
    noAddressProfiles: 0,
    conflictSourceProfiles: 0
  };
}

function accumulateSummary(
  summary: CoverageSummary,
  record: CoverageRecord
): void {
  summary.scanned += 1;

  if (record.status === "wallet_projected") {
    summary.walletProjected += 1;
  }

  if (record.status === "repair_missing_customer_projection") {
    summary.repairMissingCustomerProjection += 1;
  }

  if (record.status === "repair_missing_customer_account") {
    summary.repairMissingCustomerAccount += 1;
  }

  if (record.status === "repair_wallet_only") {
    summary.repairWalletOnly += 1;
  }

  if (record.status === "manual_review_missing_wallet_address") {
    summary.manualReviewMissingWalletAddress += 1;
  }

  if (record.status === "manual_review_invalid_wallet_address") {
    summary.manualReviewInvalidWalletAddress += 1;
  }

  if (record.status === "manual_review_conflicting_customer_records") {
    summary.manualReviewConflictingCustomerRecords += 1;
  }

  if (record.status === "manual_review_wallet_linked_to_other_account") {
    summary.manualReviewWalletLinkedToOtherAccount += 1;
  }

  if (record.status === "manual_review_wallet_legacy_mismatch") {
    summary.manualReviewWalletLegacyMismatch += 1;
  }

  if (record.status === "manual_review_multiple_product_chain_wallets") {
    summary.manualReviewMultipleProductChainWallets += 1;
  }

  if (isWalletProjectionAutoRepairable(record.status)) {
    summary.autoRepairableProfiles += 1;
  }

  if (
    isWalletProjectionActionable(record.status) &&
    !isWalletProjectionAutoRepairable(record.status)
  ) {
    summary.manualReviewProfiles += 1;
  }

  if (record.addressSource === "wallet") {
    summary.walletSourceProfiles += 1;
  }

  if (record.addressSource === "legacy") {
    summary.legacySourceProfiles += 1;
  }

  if (record.addressSource === "none") {
    summary.noAddressProfiles += 1;
  }

  if (record.addressSource === "conflict") {
    summary.conflictSourceProfiles += 1;
  }
}

async function buildCoverageRecord(
  prisma: ReturnType<typeof createStealthTrailsPrismaClient>,
  legacyUser: LegacyUserRecord,
  productChainId: number
): Promise<CoverageRecord> {
  const resolution = await resolveWalletProjectionResolution(
    prisma,
    legacyUser,
    productChainId
  );

  return {
    legacyUserId: legacyUser.id,
    email: legacyUser.email,
    supabaseUserId: legacyUser.supabaseUserId,
    productChainId,
    status: resolution.surface,
    addressSource: resolution.addressSource,
    repairCommand: mapWalletProjectionSurfaceToRepairCommand(
      resolution.surface
    ),
    manualReviewCase: mapWalletProjectionSurfaceToManualReviewCase(
      resolution.surface
    ),
    legacyEthereumAddress: resolution.normalizedLegacyEthereumAddress,
    walletAddresses: resolution.walletAddresses,
    customerId: resolution.customerId,
    customerAccountId: resolution.customerAccountId,
    linkedCustomerAccountId: resolution.linkedCustomerAccountId,
    reason: resolution.reason
  };
}

async function main(): Promise<void> {
  loadDatabaseRuntimeConfig();

  const options = parseOptions(process.argv.slice(2));
  const prisma = createStealthTrailsPrismaClient();
  const productChainId = loadProductChainRuntimeConfig().productChainId;
  const summary = createSummary(productChainId);
  const details: CoverageRecord[] = [];

  try {
    const legacyUsers = await prisma.user.findMany({
      where: options.email ? { email: options.email } : undefined,
      orderBy: {
        id: "asc"
      },
      take: options.limit
    });

    for (const legacyUser of legacyUsers) {
      const record = await buildCoverageRecord(
        prisma,
        legacyUser,
        productChainId
      );

      accumulateSummary(summary, record);

      if (options.summaryOnly) {
        continue;
      }

      if (options.onlyActionable && !isWalletProjectionActionable(record.status)) {
        continue;
      }

      details.push(record);
    }

    console.log(
      JSON.stringify(
        {
          summary,
          details: options.summaryOnly ? [] : details
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(error.message);
    process.exit(1);
  }

  console.error("Wallet projection coverage audit failed.");
  process.exit(1);
});
