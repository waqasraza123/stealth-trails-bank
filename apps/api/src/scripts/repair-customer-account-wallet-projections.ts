import {
  loadDatabaseRuntimeConfig,
  loadProductChainRuntimeConfig
} from "@stealth-trails-bank/config/api";
import { createStealthTrailsPrismaClient } from "@stealth-trails-bank/db";
import {
  AccountLifecycleStatus,
  WalletCustodyType,
  WalletKind,
  WalletStatus,
  type Prisma
} from "@prisma/client";
import {
  type LegacyUserRecord,
  type WalletProjectionRepairMethod,
  resolveWalletProjectionResolution
} from "./lib/wallet-projection-migration";

type ScriptOptions = {
  applyChanges: boolean;
  email?: string;
  limit?: number;
};

type RepairAction =
  | "already_projected"
  | "repair_account_and_wallet"
  | "missing_wallet_address"
  | "invalid_wallet_address"
  | "missing_customer_projection"
  | "customer_account_exists"
  | "conflict";

type RepairPlan = {
  action: RepairAction;
  legacyUser: LegacyUserRecord;
  customerId?: string;
  normalizedAddress?: string;
  repairMethod?: WalletProjectionRepairMethod;
  reason?: string;
};

type RepairSummary = {
  mode: "dry-run" | "apply";
  chainId: number;
  scanned: number;
  alreadyProjected: number;
  repairAccountAndWallet: number;
  missingWalletAddress: number;
  invalidWalletAddress: number;
  missingCustomerProjection: number;
  customerAccountExists: number;
  conflicts: number;
  plannedWalletCreates: number;
  plannedWalletAttachments: number;
  appliedCustomerAccountCreates: number;
  appliedWalletCreates: number;
  appliedWalletAttachments: number;
};

function parseOptions(argv: string[]): ScriptOptions {
  let applyChanges = false;
  let email: string | undefined;
  let limit: number | undefined;

  for (const argument of argv) {
    if (argument === "--apply") {
      applyChanges = true;
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
    applyChanges,
    email,
    limit
  };
}

async function buildRepairPlan(
  prisma: ReturnType<typeof createStealthTrailsPrismaClient>,
  legacyUser: LegacyUserRecord,
  productChainId: number
): Promise<RepairPlan> {
  const resolution = await resolveWalletProjectionResolution(
    prisma,
    legacyUser,
    productChainId
  );

  if (resolution.surface === "wallet_projected") {
    return {
      action: "already_projected",
      legacyUser,
      customerId: resolution.customerId ?? undefined,
      normalizedAddress: resolution.normalizedLegacyEthereumAddress ?? undefined
    };
  }

  if (resolution.surface === "repair_missing_customer_account") {
    return {
      action: "repair_account_and_wallet",
      legacyUser,
      customerId: resolution.customerId ?? undefined,
      normalizedAddress: resolution.normalizedLegacyEthereumAddress ?? undefined,
      repairMethod: resolution.repairMethod,
      reason: resolution.reason
    };
  }

  if (resolution.surface === "repair_missing_customer_projection") {
    return {
      action: "missing_customer_projection",
      legacyUser,
      normalizedAddress: resolution.normalizedLegacyEthereumAddress ?? undefined,
      reason: resolution.reason
    };
  }

  if (resolution.surface === "repair_wallet_only") {
    return {
      action: "customer_account_exists",
      legacyUser,
      customerId: resolution.customerId ?? undefined,
      normalizedAddress: resolution.normalizedLegacyEthereumAddress ?? undefined,
      reason:
        "Customer account already exists. Use the wallet-only repair flow instead."
    };
  }

  if (resolution.surface === "manual_review_missing_wallet_address") {
    return {
      action: "missing_wallet_address",
      legacyUser,
      customerId: resolution.customerId ?? undefined,
      reason: resolution.reason
    };
  }

  if (resolution.surface === "manual_review_invalid_wallet_address") {
    return {
      action: "invalid_wallet_address",
      legacyUser,
      customerId: resolution.customerId ?? undefined,
      reason: resolution.reason
    };
  }

  return {
    action: "conflict",
    legacyUser,
    customerId: resolution.customerId ?? undefined,
    normalizedAddress: resolution.normalizedLegacyEthereumAddress ?? undefined,
    reason: resolution.reason
  };
}

async function applyRepairPlan(
  prisma: ReturnType<typeof createStealthTrailsPrismaClient>,
  plan: RepairPlan,
  productChainId: number
): Promise<{
  customerAccountCreated: boolean;
  walletCreated: boolean;
  walletAttached: boolean;
}> {
  if (plan.action !== "repair_account_and_wallet") {
    return {
      customerAccountCreated: false,
      walletCreated: false,
      walletAttached: false
    };
  }

  if (!plan.customerId || !plan.normalizedAddress) {
    throw new Error(
      "Customer id and normalized address are required for account-and-wallet repair."
    );
  }

  const customerId = plan.customerId;
  const normalizedAddress = plan.normalizedAddress;

  return prisma.$transaction(async (transaction: Prisma.TransactionClient) => {
    const resolution = await resolveWalletProjectionResolution(
      transaction,
      plan.legacyUser,
      productChainId
    );

    if (
      resolution.surface !== "repair_missing_customer_account" ||
      resolution.customerId !== customerId ||
      resolution.normalizedLegacyEthereumAddress !== normalizedAddress
    ) {
      throw new Error("Customer-account repair preconditions no longer hold.");
    }

    const customerAccount = await transaction.customerAccount.create({
      data: {
        customerId,
        status: AccountLifecycleStatus.registered
      }
    });

    if (resolution.repairMethod === "attach_existing_wallet") {
      await transaction.wallet.update({
        where: {
          chainId_address: {
            chainId: productChainId,
            address: normalizedAddress
          }
        },
        data: {
          customerAccountId: customerAccount.id,
          kind: WalletKind.embedded,
          custodyType: WalletCustodyType.platform_managed,
          status: WalletStatus.active
        }
      });

      return {
        customerAccountCreated: true,
        walletCreated: false,
        walletAttached: true
      };
    }

    await transaction.wallet.create({
      data: {
        customerAccountId: customerAccount.id,
        chainId: productChainId,
        address: normalizedAddress,
        kind: WalletKind.embedded,
        custodyType: WalletCustodyType.platform_managed,
        status: WalletStatus.active
      }
    });

    return {
      customerAccountCreated: true,
      walletCreated: true,
      walletAttached: false
    };
  });
}

function createSummary(
  mode: "dry-run" | "apply",
  chainId: number
): RepairSummary {
  return {
    mode,
    chainId,
    scanned: 0,
    alreadyProjected: 0,
    repairAccountAndWallet: 0,
    missingWalletAddress: 0,
    invalidWalletAddress: 0,
    missingCustomerProjection: 0,
    customerAccountExists: 0,
    conflicts: 0,
    plannedWalletCreates: 0,
    plannedWalletAttachments: 0,
    appliedCustomerAccountCreates: 0,
    appliedWalletCreates: 0,
    appliedWalletAttachments: 0
  };
}

async function main(): Promise<void> {
  loadDatabaseRuntimeConfig();

  const options = parseOptions(process.argv.slice(2));
  const prisma = createStealthTrailsPrismaClient();
  const productChainId = loadProductChainRuntimeConfig().productChainId;
  const summary = createSummary(
    options.applyChanges ? "apply" : "dry-run",
    productChainId
  );
  const conflicts: Array<{
    email: string;
    supabaseUserId: string;
    reason: string;
  }> = [];
  const plannedActions: Array<{
    email: string;
    supabaseUserId: string;
    action: RepairAction;
    repairMethod: WalletProjectionRepairMethod;
    normalizedAddress: string | null;
  }> = [];

  try {
    const legacyUsers = await prisma.user.findMany({
      where: options.email ? { email: options.email } : undefined,
      orderBy: {
        id: "asc"
      },
      take: options.limit
    });

    summary.scanned = legacyUsers.length;

    for (const legacyUser of legacyUsers) {
      const plan = await buildRepairPlan(prisma, legacyUser, productChainId);

      plannedActions.push({
        email: legacyUser.email,
        supabaseUserId: legacyUser.supabaseUserId,
        action: plan.action,
        repairMethod: plan.repairMethod ?? null,
        normalizedAddress: plan.normalizedAddress ?? null
      });

      if (plan.action === "already_projected") {
        summary.alreadyProjected += 1;
        continue;
      }

      if (plan.action === "repair_account_and_wallet") {
        summary.repairAccountAndWallet += 1;

        if (plan.repairMethod === "create_wallet") {
          summary.plannedWalletCreates += 1;
        }

        if (plan.repairMethod === "attach_existing_wallet") {
          summary.plannedWalletAttachments += 1;
        }

        if (!options.applyChanges) {
          continue;
        }

        const applied = await applyRepairPlan(prisma, plan, productChainId);

        if (applied.customerAccountCreated) {
          summary.appliedCustomerAccountCreates += 1;
        }

        if (applied.walletCreated) {
          summary.appliedWalletCreates += 1;
        }

        if (applied.walletAttached) {
          summary.appliedWalletAttachments += 1;
        }

        continue;
      }

      if (plan.action === "missing_wallet_address") {
        summary.missingWalletAddress += 1;
        continue;
      }

      if (plan.action === "invalid_wallet_address") {
        summary.invalidWalletAddress += 1;
        conflicts.push({
          email: legacyUser.email,
          supabaseUserId: legacyUser.supabaseUserId,
          reason: plan.reason ?? "Legacy ethereumAddress is not a valid EVM address."
        });
        continue;
      }

      if (plan.action === "missing_customer_projection") {
        summary.missingCustomerProjection += 1;
        continue;
      }

      if (plan.action === "customer_account_exists") {
        summary.customerAccountExists += 1;
        continue;
      }

      summary.conflicts += 1;
      conflicts.push({
        email: legacyUser.email,
        supabaseUserId: legacyUser.supabaseUserId,
        reason: plan.reason ?? "Unknown conflict."
      });
    }

    console.log(
      JSON.stringify(
        {
          summary,
          plannedActions,
          conflicts
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

  console.error("Customer account and wallet projection repair failed.");
  process.exit(1);
});
