import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  loadDatabaseRuntimeConfig,
  loadProductChainRuntimeConfig
} from "@stealth-trails-bank/config/api";
import { createStealthTrailsPrismaClient } from "@stealth-trails-bank/db";
import {
  mapWalletProjectionSurfaceToManualReviewCase,
  resolveWalletProjectionResolution,
  type LegacyUserRecord
} from "./lib/wallet-projection-migration";

type OutputFormat = "json" | "csv";

type ScriptOptions = {
  email?: string;
  limit?: number;
  format: OutputFormat;
  outputPath?: string;
};

type ManualReviewQueueItem = {
  legacyUserId: number;
  email: string;
  supabaseUserId: string;
  productChainId: number;
  reviewCase:
    | "missing_wallet_address"
    | "invalid_wallet_address"
    | "conflicting_customer_records"
    | "wallet_linked_to_other_account"
    | "wallet_legacy_mismatch"
    | "multiple_product_chain_wallets";
  suggestedAction:
    | "repair_legacy_wallet_address"
    | "reconcile_wallet_mismatch"
    | "review_wallet_link_conflict"
    | "resolve_customer_identity_conflict"
    | "resolve_duplicate_wallets";
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

function mapReviewCaseToSuggestedAction(
  reviewCase: ManualReviewQueueItem["reviewCase"]
): ManualReviewQueueItem["suggestedAction"] {
  if (reviewCase === "conflicting_customer_records") {
    return "resolve_customer_identity_conflict";
  }

  if (
    reviewCase === "missing_wallet_address" ||
    reviewCase === "invalid_wallet_address"
  ) {
    return "repair_legacy_wallet_address";
  }

  if (reviewCase === "wallet_legacy_mismatch") {
    return "reconcile_wallet_mismatch";
  }

  if (reviewCase === "wallet_linked_to_other_account") {
    return "review_wallet_link_conflict";
  }

  return "resolve_duplicate_wallets";
}

function joinWalletAddresses(walletAddresses: string[]): string {
  return walletAddresses.join(";");
}

function escapeCsvValue(value: string): string {
  if (value.includes("\"") || value.includes(",") || value.includes("\n")) {
    return "\"" + value.replace(/\"/g, "\"\"") + "\"";
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
  const resolution = await resolveWalletProjectionResolution(
    prisma,
    legacyUser,
    productChainId
  );

  const reviewCase = mapWalletProjectionSurfaceToManualReviewCase(
    resolution.surface
  );

  if (!reviewCase) {
    return null;
  }

  return {
    legacyUserId: legacyUser.id,
    email: legacyUser.email,
    supabaseUserId: legacyUser.supabaseUserId,
    productChainId,
    reviewCase,
    suggestedAction: mapReviewCaseToSuggestedAction(reviewCase),
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
  const items: ManualReviewQueueItem[] = [];

  try {
    const legacyUsers = await prisma.user.findMany({
      where: options.email ? { email: options.email } : undefined,
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
