import { createStealthTrailsPrismaClient } from "@stealth-trails-bank/db";
import { WalletStatus } from "@prisma/client";

type WalletLookupPrismaClient = Pick<
  ReturnType<typeof createStealthTrailsPrismaClient>,
  "customer" | "customerAccount" | "wallet"
>;

export type CustomerWalletLookup = {
  customerId: string | null;
  customerAccountId: string | null;
  chainId: number;
  ethereumAddress: string | null;
  source:
    | "wallet"
    | "missing-customer"
    | "missing-customer-account"
    | "missing-wallet";
};

export function loadProductChainId(): number {
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

export async function findCustomerWalletBySupabaseUserId(
  prisma: WalletLookupPrismaClient,
  supabaseUserId: string
): Promise<CustomerWalletLookup> {
  const chainId = loadProductChainId();

  const customer = await prisma.customer.findUnique({
    where: {
      supabaseUserId
    }
  });

  if (!customer) {
    return {
      customerId: null,
      customerAccountId: null,
      chainId,
      ethereumAddress: null,
      source: "missing-customer"
    };
  }

  const customerAccount = await prisma.customerAccount.findUnique({
    where: {
      customerId: customer.id
    }
  });

  if (!customerAccount) {
    return {
      customerId: customer.id,
      customerAccountId: null,
      chainId,
      ethereumAddress: null,
      source: "missing-customer-account"
    };
  }

  const wallet = await prisma.wallet.findFirst({
    where: {
      customerAccountId: customerAccount.id,
      chainId,
      status: WalletStatus.active
    }
  });

  if (!wallet) {
    return {
      customerId: customer.id,
      customerAccountId: customerAccount.id,
      chainId,
      ethereumAddress: null,
      source: "missing-wallet"
    };
  }

  return {
    customerId: customer.id,
    customerAccountId: customerAccount.id,
    chainId,
    ethereumAddress: wallet.address,
    source: "wallet"
  };
}
