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
  | "repair_customer_account_and_wallet"
  | "missing_wallet_address"
  | "invalid_wallet_address"
  | "customer_exists"
  | "conflict";

type RepairPlan = {
  action: RepairAction;
  legacyUser: LegacyUserRecord;
  normalizedAddress?: string;
  repairMethod?: WalletProjectionRepairMethod;
  reason?: string;
};

type RepairSummary = {
  mode: "dry-run" | "apply";
  chainId: number;
  scanned: number;
  repairCustomerAccountAndWallet: number;
  missingWalletAddress: number;
  invalidWalletAddress: number;
  customerExists: number;
  conflicts: number;
  plannedWalletCreates: number;
  plannedWalletAttachments: number;
  appliedCustomerCreates: number;
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

  if (resolution.surface === "repair_missing_customer_projection") {
    return {
      action: "repair_customer_account_and_wallet",
      legacyUser,
      normalizedAddress: resolution.normalizedLegacyEthereumAddress ?? undefined,
      repairMethod: resolution.repairMethod,
      reason: resolution.reason
    };
  }

  if (resolution.surface === "manual_review_missing_wallet_address") {
    return {
      action: "missing_wallet_address",
      legacyUser,
      reason: resolution.reason
    };
  }

  if (resolution.surface === "manual_review_invalid_wallet_address") {
    return {
      action: "invalid_wallet_address",
      legacyUser,
      reason: resolution.reason
    };
  }

  if (resolution.customerId) {
    return {
      action: "customer_exists",
      legacyUser,
      normalizedAddress: resolution.normalizedLegacyEthereumAddress ?? undefined,
      reason:
        "Customer projection already exists. Use narrower account or wallet repair flows instead."
    };
  }

  return {
    action: "conflict",
    legacyUser,
    normalizedAddress: resolution.normalizedLegacyEthereumAddress ?? undefined,
    reason: resolution.reason
  };
}

async function applyRepairPlan(
  prisma: ReturnType<typeof createStealthTrailsPrismaClient>,
  plan: RepairPlan,
  productChainId: number
): Promise<{
  customerCreated: boolean;
  customerAccountCreated: boolean;
  walletCreated: boolean;
  walletAttached: boolean;
}> {
  if (plan.action !== "repair_customer_account_and_wallet") {
    return {
      customerCreated: false,
      customerAccountCreated: false,
      walletCreated: false,
      walletAttached: false
    };
  }

  if (!plan.normalizedAddress) {
    throw new Error(
      "Normalized address is required for missing customer projection repair."
    );
  }

  const normalizedAddress = plan.normalizedAddress;

  return prisma.$transaction(async (transaction: Prisma.TransactionClient) => {
    const resolution = await resolveWalletProjectionResolution(
      transaction,
      plan.legacyUser,
      productChainId
    );

    if (
      resolution.surface !== "repair_missing_customer_projection" ||
      resolution.normalizedLegacyEthereumAddress !== normalizedAddress
    ) {
      throw new Error(
        "Missing customer projection repair preconditions no longer hold."
      );
    }

    const customer = await transaction.customer.create({
      data: {
        supabaseUserId: plan.legacyUser.supabaseUserId,
        email: plan.legacyUser.email,
        firstName: plan.legacyUser.firstName,
        lastName: plan.legacyUser.lastName
      }
    });

    const customerAccount = await transaction.customerAccount.create({
      data: {
        customerId: customer.id,
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
        customerCreated: true,
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
      customerCreated: true,
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
    repairCustomerAccountAndWallet: 0,
    missingWalletAddress: 0,
    invalidWalletAddress: 0,
    customerExists: 0,
    conflicts: 0,
    plannedWalletCreates: 0,
    plannedWalletAttachments: 0,
    appliedCustomerCreates: 0,
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

      if (plan.action === "repair_customer_account_and_wallet") {
        summary.repairCustomerAccountAndWallet += 1;

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

        if (applied.customerCreated) {
          summary.appliedCustomerCreates += 1;
        }

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

      if (plan.action === "customer_exists") {
        summary.customerExists += 1;
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

  console.error("Missing customer projection repair failed.");
  process.exit(1);
});
