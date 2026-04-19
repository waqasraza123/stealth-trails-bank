import { ConflictException } from "@nestjs/common";
import {
  BlockchainTransactionStatus,
  PolicyDecision,
  TransactionIntentStatus
} from "@prisma/client";
import { DepositSettlementReconciliationService } from "./deposit-settlement-reconciliation.service";

jest.mock("@stealth-trails-bank/config/api", () => ({
  loadProductChainRuntimeConfig: () => ({
    productChainId: 8453
  })
}));

function createRecord(
  overrides: Partial<{
    id: string;
    status: TransactionIntentStatus;
    policyDecision: PolicyDecision;
    blockchainStatus: BlockchainTransactionStatus | null;
    hasLedgerJournal: boolean;
    hasSettlementProof: boolean;
    settledAmount: string | null;
  }> = {}
) {
  return {
    id: overrides.id ?? "intent_1",
    customerAccountId: "account_1",
    destinationWalletId: "wallet_1",
    chainId: 8453,
    status: overrides.status ?? TransactionIntentStatus.broadcast,
    policyDecision: overrides.policyDecision ?? PolicyDecision.approved,
    requestedAmount: { toString: () => "5.00" },
    settledAmount:
      overrides.settledAmount === null
        ? null
        : { toString: () => overrides.settledAmount ?? "5.00" },
    createdAt: new Date("2026-04-01T10:00:00.000Z"),
    updatedAt: new Date("2026-04-01T10:00:00.000Z"),
    asset: {
      id: "asset_1",
      symbol: "ETH",
      displayName: "Ether",
      decimals: 18,
      chainId: 8453
    },
    destinationWallet: {
      id: "wallet_1",
      address: "0x0000000000000000000000000000000000000abc"
    },
    customerAccount: {
      id: "account_1",
      customerId: "customer_1",
      customer: {
        id: "customer_1",
        supabaseUserId: "supabase_1",
        email: "user@example.com",
        firstName: "John",
        lastName: "Doe"
      }
    },
    blockchainTransactions: overrides.blockchainStatus
      ? [
          {
            id: "chain_tx_1",
            txHash:
              "0x1111111111111111111111111111111111111111111111111111111111111111",
            status: overrides.blockchainStatus,
            fromAddress: null,
            toAddress: null,
            createdAt: new Date("2026-04-01T10:05:00.000Z"),
            updatedAt: new Date("2026-04-01T10:05:00.000Z"),
            confirmedAt:
              overrides.blockchainStatus === BlockchainTransactionStatus.confirmed
                ? new Date("2026-04-01T10:06:00.000Z")
                : null
          }
        ]
      : [],
    ledgerJournals: overrides.hasLedgerJournal
      ? [
          {
            id: "journal_1",
            journalType: "deposit_settlement",
            postedAt: new Date("2026-04-01T10:07:00.000Z"),
            createdAt: new Date("2026-04-01T10:07:00.000Z")
          }
        ]
      : [],
    depositSettlementProof: overrides.hasSettlementProof
      ? {
          id: "proof_1",
          ledgerJournalId: "journal_1",
          blockchainTransactionId: "chain_tx_1",
          txHash:
            "0x1111111111111111111111111111111111111111111111111111111111111111",
          fromAddress: "0x0000000000000000000000000000000000000def",
          toAddress: "0x0000000000000000000000000000000000000abc",
          settledAmount: { toString: () => overrides.settledAmount ?? "5.00" },
          confirmedAt: new Date("2026-04-01T10:06:00.000Z"),
          createdAt: new Date("2026-04-01T10:07:00.000Z")
        }
      : null
  };
}

function createService() {
  const prismaService = {
    transactionIntent: {
      findMany: jest.fn(),
      findFirst: jest.fn()
    }
  };

  const transactionIntentsService = {
    replayConfirmDepositIntent: jest.fn(),
    replaySettleConfirmedDepositIntent: jest.fn()
  };

  const reviewCasesService = {} as never;

  const service = new DepositSettlementReconciliationService(
    prismaService as never,
    transactionIntentsService as never,
    reviewCasesService
  );

  return {
    service,
    prismaService,
    transactionIntentsService
  };
}

describe("DepositSettlementReconciliationService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("classifies replayable and healthy settlement states", async () => {
    const { service, prismaService } = createService();

    prismaService.transactionIntent.findMany.mockResolvedValue([
      createRecord({
        id: "intent_confirm",
        status: TransactionIntentStatus.broadcast,
        blockchainStatus: BlockchainTransactionStatus.confirmed,
        hasLedgerJournal: false,
        hasSettlementProof: false,
        settledAmount: null
      }),
      createRecord({
        id: "intent_settle",
        status: TransactionIntentStatus.confirmed,
        blockchainStatus: BlockchainTransactionStatus.confirmed,
        hasLedgerJournal: false,
        hasSettlementProof: false,
        settledAmount: null
      }),
      createRecord({
        id: "intent_healthy",
        status: TransactionIntentStatus.settled,
        blockchainStatus: BlockchainTransactionStatus.confirmed,
        hasLedgerJournal: true,
        hasSettlementProof: true,
        settledAmount: "5.00"
      })
    ]);

    const result = await service.listDepositSettlementReconciliation({
      limit: 20
    });

    expect(result.summary.ready_for_confirm_replay).toBe(1);
    expect(result.summary.ready_for_settle_replay).toBe(1);
    expect(result.summary.healthy_settled).toBe(1);
    expect(result.actionableCount).toBe(2);
  });

  it("replays confirm only when the classification allows it", async () => {
    const { service, prismaService, transactionIntentsService } = createService();

    prismaService.transactionIntent.findFirst.mockResolvedValue(
      createRecord({
        status: TransactionIntentStatus.broadcast,
        blockchainStatus: BlockchainTransactionStatus.confirmed,
        hasLedgerJournal: false,
        hasSettlementProof: false,
        settledAmount: null
      })
    );

    transactionIntentsService.replayConfirmDepositIntent.mockResolvedValue({
      confirmReused: false
    });

    await service.replayConfirm("intent_1", "ops_1", {
      note: "Replay missed confirm."
    });

    expect(
      transactionIntentsService.replayConfirmDepositIntent
    ).toHaveBeenCalledWith("intent_1", "ops_1", "Replay missed confirm.");
  });

  it("rejects settle replay when the classification is not settle-replayable", async () => {
    const { service, prismaService } = createService();

    prismaService.transactionIntent.findFirst.mockResolvedValue(
      createRecord({
        status: TransactionIntentStatus.settled,
        blockchainStatus: BlockchainTransactionStatus.confirmed,
        hasLedgerJournal: true,
        hasSettlementProof: true,
        settledAmount: "5.00"
      })
    );

    await expect(
      service.replaySettle("intent_1", "ops_1", {})
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("flags settled deposits with missing proof anchors as manual-review-required", async () => {
    const { service, prismaService } = createService();

    prismaService.transactionIntent.findMany.mockResolvedValue([
      createRecord({
        id: "intent_missing_proof",
        status: TransactionIntentStatus.settled,
        blockchainStatus: BlockchainTransactionStatus.confirmed,
        hasLedgerJournal: true,
        hasSettlementProof: false,
        settledAmount: "5.00"
      })
    ]);

    const result = await service.listDepositSettlementReconciliation({
      limit: 10
    });

    expect(result.summary.manual_review_required).toBe(1);
    expect(result.items[0]?.reconciliation.reasonCode).toBe(
      "missing_settlement_proof"
    );
  });
});
