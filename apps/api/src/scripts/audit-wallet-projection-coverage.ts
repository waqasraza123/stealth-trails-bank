import {
  loadDatabaseRuntimeConfig,
  loadProductChainRuntimeConfig
} from "@stealth-trails-bank/config/api";
import { createStealthTrailsPrismaClient } from "@stealth-trails-bank/db";
import type { Customer } from "@prisma/client";
import { ethers } from "ethers";

type ScriptOptions = {
  email?: string;
  limit?: number;
  onlyActionable: boolean;
  summaryOnly: boolean;
};

type LegacyUserRecord = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  supabaseUserId: string;
  ethereumAddress: string | null;
};

type CoverageStatus =
  | "wallet_projected"
  | "repair_missing_customer_projection"
  | "repair_missing_customer_account"
  | "repair_wallet_only"
  | "manual_review_missing_wallet_address"
  | "manual_review_invalid_wallet_address"
  | "manual_review_conflicting_customer_records"
  | "manual_review_wallet_linked_to_other_account"
  | "manual_review_wallet_legacy_mismatch"
  | "manual_review_multiple_product_chain_wallets";

type AddressSource = "wallet" | "legacy" | "none" | "conflict";

type RepairCommand =
  | "repair:missing-customer-projections"
  | "repair:customer-account-wallet-projections"
  | "repair:customer-wallet-projections"
  | null;

type ManualReviewCase =
  | "missing_wallet_address"
  | "invalid_wallet_address"
  | "conflicting_customer_records"
  | "wallet_linked_to_other_account"
  | "wallet_legacy_mismatch"
  | "multiple_product_chain_wallets"
  | null;

type CoverageRecord = {
  legacyUserId: number;
  email: string;
  supabaseUserId: string;
  productChainId: number;
  status: CoverageStatus;
  addressSource: AddressSource;
  repairCommand: RepairCommand;
  manualReviewCase: ManualReviewCase;
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

    throw new Error("Unknown argument: " + argument);
  }

  return {
    email,
    limit,
    onlyActionable,
    summaryOnly
  };
}

function normalizeWalletAddress(address: string | null): {
  normalizedAddress: string | null;
  reason?: string;
} {
  const rawAddress = address?.trim() ?? "";

  if (!rawAddress) {
    return {
      normalizedAddress: null
    };
  }

  if (!ethers.utils.isAddress(rawAddress)) {
    return {
      normalizedAddress: null,
      reason: "Legacy ethereumAddress is not a valid EVM address."
    };
  }

  return {
    normalizedAddress: ethers.utils.getAddress(rawAddress).toLowerCase()
  };
}

function normalizeProjectedWalletAddress(address: string): string {
  return address.trim().toLowerCase();
}

function resolveLegacyAddressSource(address: string | null): AddressSource {
  return address?.trim() ? "legacy" : "none";
}

function resolveExistingCustomer(
  legacyUser: LegacyUserRecord,
  customerBySupabaseUserId: Customer | null,
  customerByEmail: Customer | null
): { customer: Customer | null; reason?: string } {
  if (
    customerBySupabaseUserId &&
    customerByEmail &&
    customerBySupabaseUserId.id !== customerByEmail.id
  ) {
    return {
      customer: null,
      reason:
        "Conflicting customer records found for supabaseUserId and email."
    };
  }

  if (customerBySupabaseUserId) {
    if (customerBySupabaseUserId.email !== legacyUser.email) {
      return {
        customer: null,
        reason: "Existing customer email does not match legacy user email."
      };
    }

    return {
      customer: customerBySupabaseUserId
    };
  }

  if (customerByEmail) {
    if (customerByEmail.supabaseUserId !== legacyUser.supabaseUserId) {
      return {
        customer: null,
        reason:
          "Existing customer supabaseUserId does not match legacy user supabaseUserId."
      };
    }

    return {
      customer: customerByEmail
    };
  }

  return {
    customer: null
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

function isActionableStatus(status: CoverageStatus): boolean {
  return status !== "wallet_projected";
}

function isAutoRepairableStatus(status: CoverageStatus): boolean {
  return (
    status === "repair_missing_customer_projection" ||
    status === "repair_missing_customer_account" ||
    status === "repair_wallet_only"
  );
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

  if (isAutoRepairableStatus(record.status)) {
    summary.autoRepairableProfiles += 1;
  }

  if (
    isActionableStatus(record.status) &&
    !isAutoRepairableStatus(record.status)
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
  const normalizedLegacyWallet = normalizeWalletAddress(
    legacyUser.ethereumAddress
  );
  const legacyAddressSource = resolveLegacyAddressSource(
    legacyUser.ethereumAddress
  );

  const customerBySupabaseUserId = await prisma.customer.findUnique({
    where: {
      supabaseUserId: legacyUser.supabaseUserId
    }
  });

  const customerByEmail = await prisma.customer.findUnique({
    where: {
      email: legacyUser.email
    }
  });

  const resolvedCustomer = resolveExistingCustomer(
    legacyUser,
    customerBySupabaseUserId,
    customerByEmail
  );

  if (!resolvedCustomer.customer && resolvedCustomer.reason) {
    return {
      legacyUserId: legacyUser.id,
      email: legacyUser.email,
      supabaseUserId: legacyUser.supabaseUserId,
      productChainId,
      status: "manual_review_conflicting_customer_records",
      addressSource: "conflict",
      repairCommand: null,
      manualReviewCase: "conflicting_customer_records",
      legacyEthereumAddress: normalizedLegacyWallet.normalizedAddress,
      walletAddresses: [],
      customerId: null,
      customerAccountId: null,
      linkedCustomerAccountId: null,
      reason: resolvedCustomer.reason
    };
  }

  if (!resolvedCustomer.customer) {
    if (!normalizedLegacyWallet.normalizedAddress) {
      return {
        legacyUserId: legacyUser.id,
        email: legacyUser.email,
        supabaseUserId: legacyUser.supabaseUserId,
        productChainId,
        status: normalizedLegacyWallet.reason
          ? "manual_review_invalid_wallet_address"
          : "manual_review_missing_wallet_address",
        addressSource: legacyAddressSource,
        repairCommand: null,
        manualReviewCase: normalizedLegacyWallet.reason
          ? "invalid_wallet_address"
          : "missing_wallet_address",
        legacyEthereumAddress: normalizedLegacyWallet.normalizedAddress,
        walletAddresses: [],
        customerId: null,
        customerAccountId: null,
        linkedCustomerAccountId: null,
        reason:
          normalizedLegacyWallet.reason ??
          "Customer projection does not exist and legacy ethereumAddress is blank."
      };
    }

    const existingWallet = await prisma.wallet.findUnique({
      where: {
        chainId_address: {
          chainId: productChainId,
          address: normalizedLegacyWallet.normalizedAddress
        }
      }
    });

    if (existingWallet?.customerAccountId) {
      return {
        legacyUserId: legacyUser.id,
        email: legacyUser.email,
        supabaseUserId: legacyUser.supabaseUserId,
        productChainId,
        status: "manual_review_wallet_linked_to_other_account",
        addressSource: "legacy",
        repairCommand: null,
        manualReviewCase: "wallet_linked_to_other_account",
        legacyEthereumAddress: normalizedLegacyWallet.normalizedAddress,
        walletAddresses: [normalizedLegacyWallet.normalizedAddress],
        customerId: null,
        customerAccountId: null,
        linkedCustomerAccountId: existingWallet.customerAccountId,
        reason: "Wallet address is already linked to another customer account."
      };
    }

    return {
      legacyUserId: legacyUser.id,
      email: legacyUser.email,
      supabaseUserId: legacyUser.supabaseUserId,
      productChainId,
      status: "repair_missing_customer_projection",
      addressSource: "legacy",
      repairCommand: "repair:missing-customer-projections",
      manualReviewCase: null,
      legacyEthereumAddress: normalizedLegacyWallet.normalizedAddress,
      walletAddresses: [],
      customerId: null,
      customerAccountId: null,
      linkedCustomerAccountId: null,
      reason: "Customer projection is missing and the row is safe to auto-repair."
    };
  }

  const customerAccount = await prisma.customerAccount.findUnique({
    where: {
      customerId: resolvedCustomer.customer.id
    },
    include: {
      wallets: {
        where: {
          chainId: productChainId
        },
        orderBy: {
          createdAt: "asc"
        }
      }
    }
  });

  if (!customerAccount) {
    if (!normalizedLegacyWallet.normalizedAddress) {
      return {
        legacyUserId: legacyUser.id,
        email: legacyUser.email,
        supabaseUserId: legacyUser.supabaseUserId,
        productChainId,
        status: normalizedLegacyWallet.reason
          ? "manual_review_invalid_wallet_address"
          : "manual_review_missing_wallet_address",
        addressSource: legacyAddressSource,
        repairCommand: null,
        manualReviewCase: normalizedLegacyWallet.reason
          ? "invalid_wallet_address"
          : "missing_wallet_address",
        legacyEthereumAddress: normalizedLegacyWallet.normalizedAddress,
        walletAddresses: [],
        customerId: resolvedCustomer.customer.id,
        customerAccountId: null,
        linkedCustomerAccountId: null,
        reason:
          normalizedLegacyWallet.reason ??
          "Customer exists but legacy ethereumAddress is missing, so account-and-wallet repair cannot proceed."
      };
    }

    const existingWallet = await prisma.wallet.findUnique({
      where: {
        chainId_address: {
          chainId: productChainId,
          address: normalizedLegacyWallet.normalizedAddress
        }
      }
    });

    if (existingWallet?.customerAccountId) {
      return {
        legacyUserId: legacyUser.id,
        email: legacyUser.email,
        supabaseUserId: legacyUser.supabaseUserId,
        productChainId,
        status: "manual_review_wallet_linked_to_other_account",
        addressSource: "legacy",
        repairCommand: null,
        manualReviewCase: "wallet_linked_to_other_account",
        legacyEthereumAddress: normalizedLegacyWallet.normalizedAddress,
        walletAddresses: [normalizedLegacyWallet.normalizedAddress],
        customerId: resolvedCustomer.customer.id,
        customerAccountId: null,
        linkedCustomerAccountId: existingWallet.customerAccountId,
        reason: "Wallet address is already linked to another customer account."
      };
    }

    return {
      legacyUserId: legacyUser.id,
      email: legacyUser.email,
      supabaseUserId: legacyUser.supabaseUserId,
      productChainId,
      status: "repair_missing_customer_account",
      addressSource: "legacy",
      repairCommand: "repair:customer-account-wallet-projections",
      manualReviewCase: null,
      legacyEthereumAddress: normalizedLegacyWallet.normalizedAddress,
      walletAddresses: [],
      customerId: resolvedCustomer.customer.id,
      customerAccountId: null,
      linkedCustomerAccountId: null,
      reason:
        "Customer account projection is missing and the row is safe to auto-repair."
    };
  }

  if (customerAccount.wallets.length > 1) {
    return {
      legacyUserId: legacyUser.id,
      email: legacyUser.email,
      supabaseUserId: legacyUser.supabaseUserId,
      productChainId,
      status: "manual_review_multiple_product_chain_wallets",
      addressSource: "conflict",
      repairCommand: null,
      manualReviewCase: "multiple_product_chain_wallets",
      legacyEthereumAddress: normalizedLegacyWallet.normalizedAddress,
      walletAddresses: customerAccount.wallets
        .map((wallet) => normalizeProjectedWalletAddress(wallet.address))
        .filter((walletAddress): walletAddress is string => Boolean(walletAddress)),
      customerId: resolvedCustomer.customer.id,
      customerAccountId: customerAccount.id,
      linkedCustomerAccountId: null,
      reason: "Multiple product-chain wallets exist for this customer account."
    };
  }

  const wallet = customerAccount.wallets[0] ?? null;

  if (!wallet) {
    if (!normalizedLegacyWallet.normalizedAddress) {
      return {
        legacyUserId: legacyUser.id,
        email: legacyUser.email,
        supabaseUserId: legacyUser.supabaseUserId,
        productChainId,
        status: normalizedLegacyWallet.reason
          ? "manual_review_invalid_wallet_address"
          : "manual_review_missing_wallet_address",
        addressSource: legacyAddressSource,
        repairCommand: null,
        manualReviewCase: normalizedLegacyWallet.reason
          ? "invalid_wallet_address"
          : "missing_wallet_address",
        legacyEthereumAddress: normalizedLegacyWallet.normalizedAddress,
        walletAddresses: [],
        customerId: resolvedCustomer.customer.id,
        customerAccountId: customerAccount.id,
        linkedCustomerAccountId: null,
        reason:
          normalizedLegacyWallet.reason ??
          "Customer account exists but both wallet projection and legacy ethereumAddress are missing."
      };
    }

    const existingWallet = await prisma.wallet.findUnique({
      where: {
        chainId_address: {
          chainId: productChainId,
          address: normalizedLegacyWallet.normalizedAddress
        }
      }
    });

    if (
      existingWallet?.customerAccountId &&
      existingWallet.customerAccountId !== customerAccount.id
    ) {
      return {
        legacyUserId: legacyUser.id,
        email: legacyUser.email,
        supabaseUserId: legacyUser.supabaseUserId,
        productChainId,
        status: "manual_review_wallet_linked_to_other_account",
        addressSource: "legacy",
        repairCommand: null,
        manualReviewCase: "wallet_linked_to_other_account",
        legacyEthereumAddress: normalizedLegacyWallet.normalizedAddress,
        walletAddresses: [normalizedLegacyWallet.normalizedAddress],
        customerId: resolvedCustomer.customer.id,
        customerAccountId: customerAccount.id,
        linkedCustomerAccountId: existingWallet.customerAccountId,
        reason: "Wallet address is already linked to another customer account."
      };
    }

    return {
      legacyUserId: legacyUser.id,
      email: legacyUser.email,
      supabaseUserId: legacyUser.supabaseUserId,
      productChainId,
      status: "repair_wallet_only",
      addressSource: "legacy",
      repairCommand: "repair:customer-wallet-projections",
      manualReviewCase: null,
      legacyEthereumAddress: normalizedLegacyWallet.normalizedAddress,
      walletAddresses: [],
      customerId: resolvedCustomer.customer.id,
      customerAccountId: customerAccount.id,
      linkedCustomerAccountId: null,
      reason:
        "Wallet projection is missing and the row is safe to auto-repair."
    };
  }

  const normalizedWalletAddress = normalizeProjectedWalletAddress(wallet.address);

  if (
    normalizedLegacyWallet.normalizedAddress &&
    normalizedLegacyWallet.normalizedAddress !== normalizedWalletAddress
  ) {
    return {
      legacyUserId: legacyUser.id,
      email: legacyUser.email,
      supabaseUserId: legacyUser.supabaseUserId,
      productChainId,
      status: "manual_review_wallet_legacy_mismatch",
      addressSource: "wallet",
      repairCommand: null,
      manualReviewCase: "wallet_legacy_mismatch",
      legacyEthereumAddress: normalizedLegacyWallet.normalizedAddress,
      walletAddresses: [normalizedWalletAddress],
      customerId: resolvedCustomer.customer.id,
      customerAccountId: customerAccount.id,
      linkedCustomerAccountId: null,
      reason:
        "Wallet projection exists but differs from legacy ethereumAddress."
    };
  }

  return {
    legacyUserId: legacyUser.id,
    email: legacyUser.email,
    supabaseUserId: legacyUser.supabaseUserId,
    productChainId,
    status: "wallet_projected",
    addressSource: "wallet",
    repairCommand: null,
    manualReviewCase: null,
    legacyEthereumAddress: normalizedLegacyWallet.normalizedAddress,
    walletAddresses: [normalizedWalletAddress],
    customerId: resolvedCustomer.customer.id,
    customerAccountId: customerAccount.id,
    linkedCustomerAccountId: null,
    reason: "Wallet projection is present for the configured product chain."
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
      where: options.email
        ? {
            email: options.email
          }
        : undefined,
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

      if (options.onlyActionable && !isActionableStatus(record.status)) {
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
