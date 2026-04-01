import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  loadDatabaseRuntimeConfig,
  loadProductChainRuntimeConfig
} from "@stealth-trails-bank/config/api";
import { createStealthTrailsPrismaClient } from "@stealth-trails-bank/db";
import type { Customer } from "@prisma/client";
import { ethers } from "ethers";

type OutputFormat = "json" | "csv";

type ScriptOptions = {
  email?: string;
  limit?: number;
  format: OutputFormat;
  outputPath?: string;
};

type LegacyUserRecord = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  supabaseUserId: string;
  ethereumAddress: string | null;
};

type ManualReviewCase =
  | "conflicting_customer_records"
  | "missing_wallet_address"
  | "invalid_wallet_address"
  | "wallet_legacy_mismatch"
  | "wallet_linked_to_other_account"
  | "multiple_product_chain_wallets";

type SuggestedAction =
  | "repair_legacy_wallet_address"
  | "reconcile_wallet_mismatch"
  | "review_wallet_link_conflict"
  | "resolve_customer_identity_conflict"
  | "resolve_duplicate_wallets";

type ManualReviewQueueItem = {
  legacyUserId: number;
  email: string;
  supabaseUserId: string;
  productChainId: number;
  reviewCase: ManualReviewCase;
  suggestedAction: SuggestedAction;
  legacyEthereumAddress: string | null;
  walletAddresses: string[];
  customerId: string | null;
  customerAccountId: string | null;
  linkedCustomerAccountId: string | null;
  reason: string;
};

type ManualReviewSummary = {
  productChainId: number;
  scanned: number;
  queueItems: number;
  conflictingCustomerRecords: number;
  missingWalletAddress: number;
  invalidWalletAddress: number;
  walletLegacyMismatch: number;
  walletLinkedToOtherAccount: number;
  multipleProductChainWallets: number;
};

type ManualReviewExportPayload = {
  summary: ManualReviewSummary;
  items: ManualReviewQueueItem[];
};

function parseOptions(argv: string[]): ScriptOptions {
  let email: string | undefined;
  let limit: number | undefined;
  let format: OutputFormat = "json";
  let outputPath: string | undefined;

  for (const argument of argv) {
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

    if (argument.startsWith("--format=")) {
      const formatValue = argument.slice("--format=".length).trim();

      if (formatValue !== "json" && formatValue !== "csv") {
        throw new Error("The --format option must be either json or csv.");
      }

      format = formatValue;
      continue;
    }

    if (argument.startsWith("--output=")) {
      const outputValue = argument.slice("--output=".length).trim();

      if (!outputValue) {
        throw new Error("The --output option requires a non-empty value.");
      }

      outputPath = outputValue;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return {
    email,
    limit,
    format,
    outputPath
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

function createSummary(productChainId: number): ManualReviewSummary {
  return {
    productChainId,
    scanned: 0,
    queueItems: 0,
    conflictingCustomerRecords: 0,
    missingWalletAddress: 0,
    invalidWalletAddress: 0,
    walletLegacyMismatch: 0,
    walletLinkedToOtherAccount: 0,
    multipleProductChainWallets: 0
  };
}

function accumulateSummary(
  summary: ManualReviewSummary,
  item: ManualReviewQueueItem | null
): void {
  summary.scanned += 1;

  if (!item) {
    return;
  }

  summary.queueItems += 1;

  if (item.reviewCase === "conflicting_customer_records") {
    summary.conflictingCustomerRecords += 1;
  }

  if (item.reviewCase === "missing_wallet_address") {
    summary.missingWalletAddress += 1;
  }

  if (item.reviewCase === "invalid_wallet_address") {
    summary.invalidWalletAddress += 1;
  }

  if (item.reviewCase === "wallet_legacy_mismatch") {
    summary.walletLegacyMismatch += 1;
  }

  if (item.reviewCase === "wallet_linked_to_other_account") {
    summary.walletLinkedToOtherAccount += 1;
  }

  if (item.reviewCase === "multiple_product_chain_wallets") {
    summary.multipleProductChainWallets += 1;
  }
}

function joinWalletAddresses(walletAddresses: string[]): string {
  return walletAddresses.join(";");
}

function escapeCsvValue(value: string): string {
  if (value.includes("\"") || value.includes(",") || value.includes("\n")) {
    return "\"" + value.split("\"").join("\"\"") + "\"";
  }

  return value;
}

function buildCsvContent(items: ManualReviewQueueItem[]): string {
  const headers = [
    "legacyUserId",
    "email",
    "supabaseUserId",
    "productChainId",
    "reviewCase",
    "suggestedAction",
    "legacyEthereumAddress",
    "walletAddresses",
    "customerId",
    "customerAccountId",
    "linkedCustomerAccountId",
    "reason"
  ];

  const rows = items.map((item) =>
    [
      String(item.legacyUserId),
      item.email,
      item.supabaseUserId,
      String(item.productChainId),
      item.reviewCase,
      item.suggestedAction,
      item.legacyEthereumAddress ?? "",
      joinWalletAddresses(item.walletAddresses),
      item.customerId ?? "",
      item.customerAccountId ?? "",
      item.linkedCustomerAccountId ?? "",
      item.reason
    ]
      .map(escapeCsvValue)
      .join(",")
  );

  return [headers.join(","), ...rows].join("\n");
}

async function writeOutputFile(
  outputPath: string,
  content: string
): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, content, "utf-8");
}

async function buildManualReviewQueueItem(
  prisma: ReturnType<typeof createStealthTrailsPrismaClient>,
  legacyUser: LegacyUserRecord,
  productChainId: number
): Promise<ManualReviewQueueItem | null> {
  const normalizedLegacyWallet = normalizeWalletAddress(
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
      reviewCase: "conflicting_customer_records",
      suggestedAction: "resolve_customer_identity_conflict",
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
        reviewCase: normalizedLegacyWallet.reason
          ? "invalid_wallet_address"
          : "missing_wallet_address",
        suggestedAction: "repair_legacy_wallet_address",
        legacyEthereumAddress: null,
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
        reviewCase: "wallet_linked_to_other_account",
        suggestedAction: "review_wallet_link_conflict",
        legacyEthereumAddress: normalizedLegacyWallet.normalizedAddress,
        walletAddresses: [normalizedLegacyWallet.normalizedAddress],
        customerId: null,
        customerAccountId: null,
        linkedCustomerAccountId: existingWallet.customerAccountId,
        reason: "Wallet address is already linked to another customer account."
      };
    }

    return null;
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
        reviewCase: normalizedLegacyWallet.reason
          ? "invalid_wallet_address"
          : "missing_wallet_address",
        suggestedAction: "repair_legacy_wallet_address",
        legacyEthereumAddress: null,
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
        reviewCase: "wallet_linked_to_other_account",
        suggestedAction: "review_wallet_link_conflict",
        legacyEthereumAddress: normalizedLegacyWallet.normalizedAddress,
        walletAddresses: [normalizedLegacyWallet.normalizedAddress],
        customerId: resolvedCustomer.customer.id,
        customerAccountId: null,
        linkedCustomerAccountId: existingWallet.customerAccountId,
        reason: "Wallet address is already linked to another customer account."
      };
    }

    return null;
  }

  if (customerAccount.wallets.length > 1) {
    return {
      legacyUserId: legacyUser.id,
      email: legacyUser.email,
      supabaseUserId: legacyUser.supabaseUserId,
      productChainId,
      reviewCase: "multiple_product_chain_wallets",
      suggestedAction: "resolve_duplicate_wallets",
      legacyEthereumAddress: normalizedLegacyWallet.normalizedAddress,
      walletAddresses: customerAccount.wallets
        .map((wallet) => wallet.address.trim().toLowerCase())
        .filter(Boolean),
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
        reviewCase: normalizedLegacyWallet.reason
          ? "invalid_wallet_address"
          : "missing_wallet_address",
        suggestedAction: "repair_legacy_wallet_address",
        legacyEthereumAddress: null,
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
        reviewCase: "wallet_linked_to_other_account",
        suggestedAction: "review_wallet_link_conflict",
        legacyEthereumAddress: normalizedLegacyWallet.normalizedAddress,
        walletAddresses: [normalizedLegacyWallet.normalizedAddress],
        customerId: resolvedCustomer.customer.id,
        customerAccountId: customerAccount.id,
        linkedCustomerAccountId: existingWallet.customerAccountId,
        reason: "Wallet address is already linked to another customer account."
      };
    }

    return null;
  }

  const normalizedWalletAddress = wallet.address.trim().toLowerCase();

  if (
    normalizedLegacyWallet.normalizedAddress &&
    normalizedLegacyWallet.normalizedAddress !== normalizedWalletAddress
  ) {
    return {
      legacyUserId: legacyUser.id,
      email: legacyUser.email,
      supabaseUserId: legacyUser.supabaseUserId,
      productChainId,
      reviewCase: "wallet_legacy_mismatch",
      suggestedAction: "reconcile_wallet_mismatch",
      legacyEthereumAddress: normalizedLegacyWallet.normalizedAddress,
      walletAddresses: [normalizedWalletAddress],
      customerId: resolvedCustomer.customer.id,
      customerAccountId: customerAccount.id,
      linkedCustomerAccountId: null,
      reason:
        "Wallet projection exists but differs from legacy ethereumAddress."
    };
  }

  return null;
}

async function main(): Promise<void> {
  loadDatabaseRuntimeConfig();

  const options = parseOptions(process.argv.slice(2));
  const prisma = createStealthTrailsPrismaClient();
  const productChainId = loadProductChainRuntimeConfig().productChainId;
  const summary = createSummary(productChainId);
  const items: ManualReviewQueueItem[] = [];

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
      const item = await buildManualReviewQueueItem(
        prisma,
        legacyUser,
        productChainId
      );

      accumulateSummary(summary, item);

      if (item) {
        items.push(item);
      }
    }

    const payload: ManualReviewExportPayload = {
      summary,
      items
    };

    if (options.format === "json") {
      const jsonContent = JSON.stringify(payload, null, 2);

      if (options.outputPath) {
        await writeOutputFile(options.outputPath, jsonContent);

        console.log(
          JSON.stringify(
            {
              summary,
              outputPath: options.outputPath
            },
            null,
            2
          )
        );

        return;
      }

      console.log(jsonContent);
      return;
    }

    const csvContent = buildCsvContent(items);

    if (options.outputPath) {
      await writeOutputFile(options.outputPath, csvContent);

      console.log(
        JSON.stringify(
          {
            summary,
            outputPath: options.outputPath
          },
          null,
          2
        )
      );

      return;
    }

    console.log(csvContent);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(error.message);
    process.exit(1);
  }

  console.error("Wallet projection manual review export failed.");
  process.exit(1);
});
