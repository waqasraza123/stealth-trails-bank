import type { Prisma } from "@prisma/client";

type WalletProjectionRepairSurface =
  | "missing_customer_projection"
  | "missing_customer_account"
  | "wallet_only";

type WalletProjectionRepairCommand =
  | "repair:missing-customer-projections"
  | "repair:customer-account-wallet-projections"
  | "repair:customer-wallet-projections";

type WalletProjectionRepairMethod = "create_wallet" | "attach_existing_wallet";

type CreateWalletProjectionRepairAuditEventInput = {
  transaction: Prisma.TransactionClient;
  customerId: string;
  customerAccountId: string;
  walletId: string;
  walletAddress: string;
  productChainId: number;
  repairCommand: WalletProjectionRepairCommand;
  repairSurface: WalletProjectionRepairSurface;
  repairMethod: WalletProjectionRepairMethod;
  legacyUserId: number;
  supabaseUserId: string;
  email: string;
  customerCreated: boolean;
  customerAccountCreated: boolean;
  walletCreated: boolean;
  walletAttached: boolean;
};

function readBatchRunId(): string | null {
  const batchRunId = process.env["WALLET_PROJECTION_BATCH_RUN_ID"]?.trim();
  return batchRunId ? batchRunId : null;
}

export async function createWalletProjectionRepairAuditEvent(
  input: CreateWalletProjectionRepairAuditEventInput
): Promise<void> {
  const batchRunId = readBatchRunId();

  const metadata: Prisma.InputJsonObject = {
    repairCommand: input.repairCommand,
    repairSurface: input.repairSurface,
    repairMethod: input.repairMethod,
    legacyUserId: input.legacyUserId,
    supabaseUserId: input.supabaseUserId,
    email: input.email,
    productChainId: input.productChainId,
    customerAccountId: input.customerAccountId,
    walletId: input.walletId,
    walletAddress: input.walletAddress,
    customerCreated: input.customerCreated,
    customerAccountCreated: input.customerAccountCreated,
    walletCreated: input.walletCreated,
    walletAttached: input.walletAttached,
    batchRunId
  };

  await input.transaction.auditEvent.create({
    data: {
      customerId: input.customerId,
      actorType: "system",
      actorId: input.repairCommand,
      action: `wallet_projection.${input.repairSurface}.repaired`,
      targetType: "CustomerAccount",
      targetId: input.customerAccountId,
      metadata
    }
  });
}
