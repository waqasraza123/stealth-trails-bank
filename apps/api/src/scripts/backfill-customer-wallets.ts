import { loadDatabaseRuntimeConfig } from "@stealth-trails-bank/config/api";
import { createStealthTrailsPrismaClient } from "@stealth-trails-bank/db";
import {
  AccountLifecycleStatus,
  WalletCustodyType,
  WalletKind,
  WalletStatus,
  type Customer,
  type Prisma
} from "@prisma/client";
import { ethers } from "ethers";

type ScriptOptions = {
  applyChanges: boolean;
  email?: string;
  limit?: number;
};

type LegacyUserRecord = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  supabaseUserId: string;
  ethereumAddress: string | null;
};

type WalletBackfillAction =
  | "already_projected"
  | "missing_wallet_address"
  | "invalid_wallet_address"
  | "create_customer_account_and_wallet"
  | "create_account_and_wallet"
  | "create_wallet_only"
  | "conflict";

type WalletBackfillPlan = {
  action: WalletBackfillAction;
  legacyUser: LegacyUserRecord;
  customerId?: string;
  customerAccountId?: string;
  normalizedAddress?: string;
  reason?: string;
};

type WalletBackfillSummary = {
  mode: "dry-run" | "apply";
  chainId: number;
  scanned: number;
  alreadyProjected: number;
  missingWalletAddress: number;
  invalidWalletAddress: number;
  createCustomerAccountAndWallet: number;
  createAccountAndWallet: number;
  createWalletOnly: number;
  conflicts: number;
  appliedCustomerCreates: number;
  appliedCustomerAccountCreates: number;
  appliedWalletCreates: number;
  appliedWalletUpdates: number;
};

type PrismaClientLike = ReturnType<typeof createStealthTrailsPrismaClient>;

function loadProductChainId(): number {
  const rawProductChainId = process.env["PRODUCT_CHAIN_ID"]?.trim();

  if (!rawProductChainId) {
    return 8453;
  }

  const parsedProductChainId = Number(rawProductChainId);

  if (!Number.isInteger(parsedProductChainId) || parsedProductChainId <= 0) {
    throw new Error("PRODUCT_CHAIN_ID must be a positive integer.");
  }

  return parsedProductChainId;
}

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
      const emailValue = argument.slice("--email=".length).trim().toLowerCase();

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

async function buildWalletBackfillPlan(
  prisma: PrismaClientLike,
  legacyUser: LegacyUserRecord,
  productChainId: number
): Promise<WalletBackfillPlan> {
  const normalizedWallet = normalizeWalletAddress(legacyUser.ethereumAddress);

  if (!normalizedWallet.normalizedAddress) {
    if (normalizedWallet.reason) {
      return {
        action: "invalid_wallet_address",
        legacyUser,
        reason: normalizedWallet.reason
      };
    }

    return {
      action: "missing_wallet_address",
      legacyUser
    };
  }

  const normalizedAddress = normalizedWallet.normalizedAddress;

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
      action: "conflict",
      legacyUser,
      normalizedAddress,
      reason: resolvedCustomer.reason
    };
  }

  const existingWallet = await prisma.wallet.findUnique({
    where: {
      chainId_address: {
        chainId: productChainId,
        address: normalizedAddress
      }
    }
  });

  if (!resolvedCustomer.customer) {
    if (existingWallet?.customerAccountId) {
      return {
        action: "conflict",
        legacyUser,
        normalizedAddress,
        reason:
          "Wallet address is already linked to another customer account."
      };
    }

    return {
      action: "create_customer_account_and_wallet",
      legacyUser,
      normalizedAddress
    };
  }

  const customerAccount = await prisma.customerAccount.findUnique({
    where: {
      customerId: resolvedCustomer.customer.id
    }
  });

  if (!customerAccount) {
    if (existingWallet?.customerAccountId) {
      return {
        action: "conflict",
        legacyUser,
        customerId: resolvedCustomer.customer.id,
        normalizedAddress,
        reason:
          "Wallet address is already linked to another customer account."
      };
    }

    return {
      action: "create_account_and_wallet",
      legacyUser,
      customerId: resolvedCustomer.customer.id,
      normalizedAddress
    };
  }

  if (
    existingWallet?.customerAccountId &&
    existingWallet.customerAccountId !== customerAccount.id
  ) {
    return {
      action: "conflict",
      legacyUser,
      customerId: resolvedCustomer.customer.id,
      customerAccountId: customerAccount.id,
      normalizedAddress,
      reason: "Wallet address is already linked to another customer account."
    };
  }

  const existingCustomerWallet = await prisma.wallet.findFirst({
    where: {
      customerAccountId: customerAccount.id,
      chainId: productChainId
    }
  });

  if (existingCustomerWallet) {
    if (existingCustomerWallet.address !== normalizedAddress) {
      return {
        action: "conflict",
        legacyUser,
        customerId: resolvedCustomer.customer.id,
        customerAccountId: customerAccount.id,
        normalizedAddress,
        reason:
          "Customer account already has a different wallet for the product chain."
      };
    }

    return {
      action: "already_projected",
      legacyUser,
      customerId: resolvedCustomer.customer.id,
      customerAccountId: customerAccount.id,
      normalizedAddress
    };
  }

  return {
    action: "create_wallet_only",
    legacyUser,
    customerId: resolvedCustomer.customer.id,
    customerAccountId: customerAccount.id,
    normalizedAddress
  };
}

async function applyWalletBackfillPlan(
  prisma: PrismaClientLike,
  plan: WalletBackfillPlan,
  productChainId: number
): Promise<{
  customerCreated: boolean;
  customerAccountCreated: boolean;
  walletCreated: boolean;
  walletUpdated: boolean;
}> {
  if (
    plan.action === "already_projected" ||
    plan.action === "missing_wallet_address" ||
    plan.action === "invalid_wallet_address" ||
    plan.action === "conflict"
  ) {
    return {
      customerCreated: false,
      customerAccountCreated: false,
      walletCreated: false,
      walletUpdated: false
    };
  }

  if (!plan.normalizedAddress) {
    throw new Error("Normalized wallet address is required.");
  }

  if (plan.action === "create_customer_account_and_wallet") {
    const normalizedAddress = plan.normalizedAddress;

    await prisma.$transaction(async (transaction: Prisma.TransactionClient) => {
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
          status: AccountLifecycleStatus.registered,
          customer: {
            connect: {
              id: customer.id
            }
          }
        }
      });

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
    });

    return {
      customerCreated: true,
      customerAccountCreated: true,
      walletCreated: true,
      walletUpdated: false
    };
  }

  if (plan.action === "create_account_and_wallet") {
    const customerId = plan.customerId;
    const normalizedAddress = plan.normalizedAddress;

    if (!customerId) {
      throw new Error("Customer id is required to create a missing account.");
    }

    await prisma.$transaction(async (transaction: Prisma.TransactionClient) => {
      const customerAccount = await transaction.customerAccount.create({
        data: {
          status: AccountLifecycleStatus.registered,
          customer: {
            connect: {
              id: customerId
            }
          }
        }
      });

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
    });

    return {
      customerCreated: false,
      customerAccountCreated: true,
      walletCreated: true,
      walletUpdated: false
    };
  }

  if (plan.action !== "create_wallet_only") {
    throw new Error(`Unsupported action: ${plan.action}`);
  }

  const customerAccountId = plan.customerAccountId;
  const normalizedAddress = plan.normalizedAddress;

  if (!customerAccountId) {
    throw new Error("Customer account id is required to create a wallet.");
  }

  const existingWallet = await prisma.wallet.findUnique({
    where: {
      chainId_address: {
        chainId: productChainId,
        address: normalizedAddress
      }
    }
  });

  if (existingWallet) {
    await prisma.wallet.update({
      where: {
        chainId_address: {
          chainId: productChainId,
          address: normalizedAddress
        }
      },
      data: {
        customerAccountId,
        kind: WalletKind.embedded,
        custodyType: WalletCustodyType.platform_managed,
        status: WalletStatus.active
      }
    });

    return {
      customerCreated: false,
      customerAccountCreated: false,
      walletCreated: false,
      walletUpdated: true
    };
  }

  await prisma.wallet.create({
    data: {
      customerAccountId,
      chainId: productChainId,
      address: normalizedAddress,
      kind: WalletKind.embedded,
      custodyType: WalletCustodyType.platform_managed,
      status: WalletStatus.active
    }
  });

  return {
    customerCreated: false,
    customerAccountCreated: false,
    walletCreated: true,
    walletUpdated: false
  };
}

function createSummary(
  mode: "dry-run" | "apply",
  chainId: number
): WalletBackfillSummary {
  return {
    mode,
    chainId,
    scanned: 0,
    alreadyProjected: 0,
    missingWalletAddress: 0,
    invalidWalletAddress: 0,
    createCustomerAccountAndWallet: 0,
    createAccountAndWallet: 0,
    createWalletOnly: 0,
    conflicts: 0,
    appliedCustomerCreates: 0,
    appliedCustomerAccountCreates: 0,
    appliedWalletCreates: 0,
    appliedWalletUpdates: 0
  };
}

async function main(): Promise<void> {
  loadDatabaseRuntimeConfig();

  const options = parseOptions(process.argv.slice(2));
  const prisma = createStealthTrailsPrismaClient();
  const productChainId = loadProductChainId();
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
    action: WalletBackfillAction;
    normalizedAddress: string | null;
    reason?: string;
  }> = [];

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

    summary.scanned = legacyUsers.length;

    for (const legacyUser of legacyUsers) {
      const plan = await buildWalletBackfillPlan(
        prisma,
        legacyUser,
        productChainId
      );

      plannedActions.push({
        email: legacyUser.email,
        supabaseUserId: legacyUser.supabaseUserId,
        action: plan.action,
        normalizedAddress: plan.normalizedAddress ?? null,
        reason: plan.reason
      });

      if (plan.action === "already_projected") {
        summary.alreadyProjected += 1;
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
          reason: plan.reason ?? "Invalid legacy wallet address."
        });
        continue;
      }

      if (plan.action === "create_customer_account_and_wallet") {
        summary.createCustomerAccountAndWallet += 1;
      }

      if (plan.action === "create_account_and_wallet") {
        summary.createAccountAndWallet += 1;
      }

      if (plan.action === "create_wallet_only") {
        summary.createWalletOnly += 1;
      }

      if (plan.action === "conflict") {
        summary.conflicts += 1;
        conflicts.push({
          email: legacyUser.email,
          supabaseUserId: legacyUser.supabaseUserId,
          reason: plan.reason ?? "Unknown conflict."
        });
        continue;
      }

      if (!options.applyChanges) {
        continue;
      }

      const applied = await applyWalletBackfillPlan(
        prisma,
        plan,
        productChainId
      );

      if (applied.customerCreated) {
        summary.appliedCustomerCreates += 1;
      }

      if (applied.customerAccountCreated) {
        summary.appliedCustomerAccountCreates += 1;
      }

      if (applied.walletCreated) {
        summary.appliedWalletCreates += 1;
      }

      if (applied.walletUpdated) {
        summary.appliedWalletUpdates += 1;
      }
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

  console.error("Wallet backfill failed.");
  process.exit(1);
});
