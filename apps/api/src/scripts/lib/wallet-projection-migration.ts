import { createStealthTrailsPrismaClient } from "@stealth-trails-bank/db";
import type { Customer } from "@prisma/client";
import { ethers } from "ethers";

export type LegacyUserRecord = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  supabaseUserId: string;
  ethereumAddress: string | null;
};

export type WalletProjectionSurface =
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

export type WalletProjectionAddressSource =
  | "wallet"
  | "legacy"
  | "none"
  | "conflict";

export type WalletProjectionRepairMethod =
  | "create_wallet"
  | "attach_existing_wallet"
  | null;

export type WalletProjectionResolution = {
  legacyUser: LegacyUserRecord;
  productChainId: number;
  surface: WalletProjectionSurface;
  addressSource: WalletProjectionAddressSource;
  normalizedLegacyEthereumAddress: string | null;
  walletAddresses: string[];
  customerId: string | null;
  customerAccountId: string | null;
  linkedCustomerAccountId: string | null;
  repairMethod: WalletProjectionRepairMethod;
  reason: string;
};

export type WalletProjectionMigrationPrismaClient = Pick<
  ReturnType<typeof createStealthTrailsPrismaClient>,
  "customer" | "customerAccount" | "wallet"
>;

export function normalizeLegacyWalletAddress(address: string | null): {
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

export function normalizeProjectedWalletAddress(address: string): string {
  return address.trim().toLowerCase();
}

export function resolveLegacyAddressSource(
  address: string | null
): WalletProjectionAddressSource {
  return address?.trim() ? "legacy" : "none";
}

export function resolveExistingCustomer(
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

export function isWalletProjectionActionable(
  surface: WalletProjectionSurface
): boolean {
  return surface !== "wallet_projected";
}

export function isWalletProjectionAutoRepairable(
  surface: WalletProjectionSurface
): boolean {
  return (
    surface === "repair_missing_customer_projection" ||
    surface === "repair_missing_customer_account" ||
    surface === "repair_wallet_only"
  );
}

export function mapWalletProjectionSurfaceToRepairCommand(
  surface: WalletProjectionSurface
):
  | "repair:missing-customer-projections"
  | "repair:customer-account-wallet-projections"
  | "repair:customer-wallet-projections"
  | null {
  if (surface === "repair_missing_customer_projection") {
    return "repair:missing-customer-projections";
  }

  if (surface === "repair_missing_customer_account") {
    return "repair:customer-account-wallet-projections";
  }

  if (surface === "repair_wallet_only") {
    return "repair:customer-wallet-projections";
  }

  return null;
}

export function mapWalletProjectionSurfaceToManualReviewCase(
  surface: WalletProjectionSurface
):
  | "missing_wallet_address"
  | "invalid_wallet_address"
  | "conflicting_customer_records"
  | "wallet_linked_to_other_account"
  | "wallet_legacy_mismatch"
  | "multiple_product_chain_wallets"
  | null {
  if (surface === "manual_review_missing_wallet_address") {
    return "missing_wallet_address";
  }

  if (surface === "manual_review_invalid_wallet_address") {
    return "invalid_wallet_address";
  }

  if (surface === "manual_review_conflicting_customer_records") {
    return "conflicting_customer_records";
  }

  if (surface === "manual_review_wallet_linked_to_other_account") {
    return "wallet_linked_to_other_account";
  }

  if (surface === "manual_review_wallet_legacy_mismatch") {
    return "wallet_legacy_mismatch";
  }

  if (surface === "manual_review_multiple_product_chain_wallets") {
    return "multiple_product_chain_wallets";
  }

  return null;
}

export async function resolveWalletProjectionResolution(
  prisma: WalletProjectionMigrationPrismaClient,
  legacyUser: LegacyUserRecord,
  productChainId: number
): Promise<WalletProjectionResolution> {
  const normalizedLegacyWallet = normalizeLegacyWalletAddress(
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
      legacyUser,
      productChainId,
      surface: "manual_review_conflicting_customer_records",
      addressSource: "conflict",
      normalizedLegacyEthereumAddress: normalizedLegacyWallet.normalizedAddress,
      walletAddresses: [],
      customerId: null,
      customerAccountId: null,
      linkedCustomerAccountId: null,
      repairMethod: null,
      reason: resolvedCustomer.reason
    };
  }

  if (!resolvedCustomer.customer) {
    if (!normalizedLegacyWallet.normalizedAddress) {
      return {
        legacyUser,
        productChainId,
        surface: normalizedLegacyWallet.reason
          ? "manual_review_invalid_wallet_address"
          : "manual_review_missing_wallet_address",
        addressSource: legacyAddressSource,
        normalizedLegacyEthereumAddress:
          normalizedLegacyWallet.normalizedAddress,
        walletAddresses: [],
        customerId: null,
        customerAccountId: null,
        linkedCustomerAccountId: null,
        repairMethod: null,
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
        legacyUser,
        productChainId,
        surface: "manual_review_wallet_linked_to_other_account",
        addressSource: "legacy",
        normalizedLegacyEthereumAddress:
          normalizedLegacyWallet.normalizedAddress,
        walletAddresses: [normalizedLegacyWallet.normalizedAddress],
        customerId: null,
        customerAccountId: null,
        linkedCustomerAccountId: existingWallet.customerAccountId,
        repairMethod: null,
        reason: "Wallet address is already linked to another customer account."
      };
    }

    return {
      legacyUser,
      productChainId,
      surface: "repair_missing_customer_projection",
      addressSource: "legacy",
      normalizedLegacyEthereumAddress: normalizedLegacyWallet.normalizedAddress,
      walletAddresses: [],
      customerId: null,
      customerAccountId: null,
      linkedCustomerAccountId: null,
      repairMethod: existingWallet ? "attach_existing_wallet" : "create_wallet",
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
        legacyUser,
        productChainId,
        surface: normalizedLegacyWallet.reason
          ? "manual_review_invalid_wallet_address"
          : "manual_review_missing_wallet_address",
        addressSource: legacyAddressSource,
        normalizedLegacyEthereumAddress:
          normalizedLegacyWallet.normalizedAddress,
        walletAddresses: [],
        customerId: resolvedCustomer.customer.id,
        customerAccountId: null,
        linkedCustomerAccountId: null,
        repairMethod: null,
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
        legacyUser,
        productChainId,
        surface: "manual_review_wallet_linked_to_other_account",
        addressSource: "legacy",
        normalizedLegacyEthereumAddress:
          normalizedLegacyWallet.normalizedAddress,
        walletAddresses: [normalizedLegacyWallet.normalizedAddress],
        customerId: resolvedCustomer.customer.id,
        customerAccountId: null,
        linkedCustomerAccountId: existingWallet.customerAccountId,
        repairMethod: null,
        reason: "Wallet address is already linked to another customer account."
      };
    }

    return {
      legacyUser,
      productChainId,
      surface: "repair_missing_customer_account",
      addressSource: "legacy",
      normalizedLegacyEthereumAddress: normalizedLegacyWallet.normalizedAddress,
      walletAddresses: [],
      customerId: resolvedCustomer.customer.id,
      customerAccountId: null,
      linkedCustomerAccountId: null,
      repairMethod: existingWallet ? "attach_existing_wallet" : "create_wallet",
      reason:
        "Customer account projection is missing and the row is safe to auto-repair."
    };
  }

  if (customerAccount.wallets.length > 1) {
    return {
      legacyUser,
      productChainId,
      surface: "manual_review_multiple_product_chain_wallets",
      addressSource: "conflict",
      normalizedLegacyEthereumAddress: normalizedLegacyWallet.normalizedAddress,
      walletAddresses: customerAccount.wallets
        .map((wallet) => normalizeProjectedWalletAddress(wallet.address))
        .filter((walletAddress): walletAddress is string => Boolean(walletAddress)),
      customerId: resolvedCustomer.customer.id,
      customerAccountId: customerAccount.id,
      linkedCustomerAccountId: null,
      repairMethod: null,
      reason: "Multiple product-chain wallets exist for this customer account."
    };
  }

  const wallet = customerAccount.wallets[0] ?? null;

  if (!wallet) {
    if (!normalizedLegacyWallet.normalizedAddress) {
      return {
        legacyUser,
        productChainId,
        surface: normalizedLegacyWallet.reason
          ? "manual_review_invalid_wallet_address"
          : "manual_review_missing_wallet_address",
        addressSource: legacyAddressSource,
        normalizedLegacyEthereumAddress:
          normalizedLegacyWallet.normalizedAddress,
        walletAddresses: [],
        customerId: resolvedCustomer.customer.id,
        customerAccountId: customerAccount.id,
        linkedCustomerAccountId: null,
        repairMethod: null,
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
        legacyUser,
        productChainId,
        surface: "manual_review_wallet_linked_to_other_account",
        addressSource: "legacy",
        normalizedLegacyEthereumAddress:
          normalizedLegacyWallet.normalizedAddress,
        walletAddresses: [normalizedLegacyWallet.normalizedAddress],
        customerId: resolvedCustomer.customer.id,
        customerAccountId: customerAccount.id,
        linkedCustomerAccountId: existingWallet.customerAccountId,
        repairMethod: null,
        reason: "Wallet address is already linked to another customer account."
      };
    }

    return {
      legacyUser,
      productChainId,
      surface: "repair_wallet_only",
      addressSource: "legacy",
      normalizedLegacyEthereumAddress: normalizedLegacyWallet.normalizedAddress,
      walletAddresses: [],
      customerId: resolvedCustomer.customer.id,
      customerAccountId: customerAccount.id,
      linkedCustomerAccountId: null,
      repairMethod: existingWallet ? "attach_existing_wallet" : "create_wallet",
      reason: "Wallet projection is missing and the row is safe to auto-repair."
    };
  }

  const normalizedWalletAddress = normalizeProjectedWalletAddress(wallet.address);

  if (
    normalizedLegacyWallet.normalizedAddress &&
    normalizedLegacyWallet.normalizedAddress !== normalizedWalletAddress
  ) {
    return {
      legacyUser,
      productChainId,
      surface: "manual_review_wallet_legacy_mismatch",
      addressSource: "wallet",
      normalizedLegacyEthereumAddress: normalizedLegacyWallet.normalizedAddress,
      walletAddresses: [normalizedWalletAddress],
      customerId: resolvedCustomer.customer.id,
      customerAccountId: customerAccount.id,
      linkedCustomerAccountId: null,
      repairMethod: null,
      reason:
        "Wallet projection exists but differs from legacy ethereumAddress."
    };
  }

  return {
    legacyUser,
    productChainId,
    surface: "wallet_projected",
    addressSource: "wallet",
    normalizedLegacyEthereumAddress: normalizedLegacyWallet.normalizedAddress,
    walletAddresses: [normalizedWalletAddress],
    customerId: resolvedCustomer.customer.id,
    customerAccountId: customerAccount.id,
    linkedCustomerAccountId: null,
    repairMethod: null,
    reason: "Wallet projection is present for the configured product chain."
  };
}
