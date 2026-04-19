import {
  BlockchainTransactionStatus,
  PolicyDecision,
  Prisma,
  TransactionIntentStatus,
  TransactionIntentType
} from "@prisma/client";
import { TransactionIntentsService } from "./transaction-intents.service";

const loadDepositRiskPolicyRuntimeConfigMock = jest.fn();

jest.mock("@stealth-trails-bank/config/api", () => ({
  loadDepositRiskPolicyRuntimeConfig: (
    env?: Record<string, string | undefined>
  ) => loadDepositRiskPolicyRuntimeConfigMock(env),
  loadProductChainRuntimeConfig: () => ({
    productChainId: 8453
  }),
  loadSensitiveOperatorActionPolicyRuntimeConfig: () => ({
    transactionIntentDecisionAllowedOperatorRoles: [
      "operations_admin",
      "risk_manager"
    ],
    custodyOperationAllowedOperatorRoles: [
      "operations_admin",
      "senior_operator",
      "treasury"
    ],
    stakingGovernanceAllowedOperatorRoles: [
      "treasury",
      "risk_manager",
      "compliance_lead"
    ]
  })
}));

function createIntentRecord(
  overrides: Partial<{
    status: TransactionIntentStatus;
    policyDecision: PolicyDecision;
    blockchainStatus: BlockchainTransactionStatus;
    settledAmount: string | null;
    fromAddress: string | null;
    toAddress: string | null;
  }> = {}
) {
  return {
    id: "intent_1",
    customerAccountId: "account_1",
    assetId: "asset_1",
    sourceWalletId: null,
    destinationWalletId: "wallet_1",
    chainId: 8453,
    intentType: TransactionIntentType.deposit,
    status: overrides.status ?? TransactionIntentStatus.broadcast,
    policyDecision: overrides.policyDecision ?? PolicyDecision.approved,
    requestedAmount: new Prisma.Decimal("5.00"),
    settledAmount:
      overrides.settledAmount === null
        ? null
        : new Prisma.Decimal(overrides.settledAmount ?? "5.00"),
    idempotencyKey: "deposit_req_1",
    failureCode: null,
    failureReason: null,
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
    blockchainTransactions: [
      {
        id: "chain_tx_1",
        txHash:
          "0x1111111111111111111111111111111111111111111111111111111111111111",
        status: overrides.blockchainStatus ?? BlockchainTransactionStatus.confirmed,
        fromAddress:
          overrides.fromAddress ??
          "0x0000000000000000000000000000000000000def",
        toAddress:
          overrides.toAddress ??
          "0x0000000000000000000000000000000000000abc",
        createdAt: new Date("2026-04-01T10:05:00.000Z"),
        updatedAt: new Date("2026-04-01T10:05:00.000Z"),
        confirmedAt:
          (overrides.blockchainStatus ?? BlockchainTransactionStatus.confirmed) ===
          BlockchainTransactionStatus.confirmed
            ? new Date("2026-04-01T10:06:00.000Z")
            : null
      }
    ]
  };
}

function createService() {
  const ledgerService = {
    settleConfirmedDeposit: jest.fn()
  };

  const transactionClient = {
    transactionIntent: {
      findFirst: jest.fn(),
      update: jest.fn()
    },
    reviewCase: {
      findUnique: jest.fn(),
      update: jest.fn()
    },
    reviewCaseEvent: {
      create: jest.fn()
    },
    depositSettlementProof: {
      findUnique: jest.fn(),
      create: jest.fn()
    },
    blockchainTransaction: {
      update: jest.fn()
    },
    ledgerJournal: {
      findUnique: jest.fn()
    },
    auditEvent: {
      create: jest.fn()
    }
  };

  const prismaService = {
    transactionIntent: {
      findFirst: jest.fn()
    },
    depositSettlementProof: {
      findUnique: jest.fn()
    },
    ledgerJournal: {
      findUnique: jest.fn()
    },
    $transaction: jest.fn(async (callback: (client: unknown) => unknown) =>
      callback(transactionClient)
    )
  };

  const service = new TransactionIntentsService(
    prismaService as never,
    ledgerService as never,
    {
      openOrReuseReviewCase: jest.fn().mockResolvedValue({
        reviewCase: {
          id: "review_case_1"
        },
        reviewCaseReused: false
      })
    } as never
  );

  return {
    service,
    prismaService,
    transactionClient,
    ledgerService
  };
}

describe("TransactionIntentsService replay methods", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    loadDepositRiskPolicyRuntimeConfigMock.mockReturnValue({
      autoApproveThresholds: []
    });
  });

  it("replays confirm with operator audit metadata", async () => {
    const { service, prismaService, transactionClient } = createService();

    prismaService.transactionIntent.findFirst.mockResolvedValue(
      createIntentRecord({
        status: TransactionIntentStatus.broadcast,
        blockchainStatus: BlockchainTransactionStatus.confirmed
      })
    );

    transactionClient.transactionIntent.findFirst
      .mockResolvedValueOnce(
        createIntentRecord({
          status: TransactionIntentStatus.broadcast,
          blockchainStatus: BlockchainTransactionStatus.confirmed
        })
      )
      .mockResolvedValueOnce(
        createIntentRecord({
          status: TransactionIntentStatus.confirmed,
          blockchainStatus: BlockchainTransactionStatus.confirmed
        })
      );

    transactionClient.blockchainTransaction.update.mockResolvedValue(undefined);
    transactionClient.transactionIntent.update.mockResolvedValue(undefined);
    transactionClient.auditEvent.create.mockResolvedValue(undefined);

    const result = await service.replayConfirmDepositIntent(
      "intent_1",
      "ops_1",
      "Replay missed confirm."
    );

    expect(result.confirmReused).toBe(false);
    expect(transactionClient.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorType: "operator",
        actorId: "ops_1",
        action: "transaction_intent.deposit.confirmed",
        metadata: expect.objectContaining({
          reconciliationReplay: true,
          replayReason: "deposit_settlement_reconciliation",
          note: "Replay missed confirm."
        })
      })
    });
  });

  it("replays settlement with operator audit metadata", async () => {
    const { service, prismaService, transactionClient, ledgerService } =
      createService();

    prismaService.transactionIntent.findFirst.mockResolvedValue(
      createIntentRecord({
        status: TransactionIntentStatus.confirmed,
        blockchainStatus: BlockchainTransactionStatus.confirmed
      })
    );

    prismaService.ledgerJournal.findUnique.mockResolvedValue(null);
    transactionClient.ledgerJournal.findUnique.mockResolvedValue(null);
    transactionClient.depositSettlementProof.findUnique.mockResolvedValue(null);

    transactionClient.transactionIntent.findFirst
      .mockResolvedValueOnce(
        createIntentRecord({
          status: TransactionIntentStatus.confirmed,
          blockchainStatus: BlockchainTransactionStatus.confirmed
        })
      )
      .mockResolvedValueOnce(
        createIntentRecord({
          status: TransactionIntentStatus.settled,
          blockchainStatus: BlockchainTransactionStatus.confirmed,
          settledAmount: "5.00"
        })
      );

    ledgerService.settleConfirmedDeposit.mockResolvedValue({
      ledgerJournalId: "journal_1",
      debitLedgerAccountId: "ledger_account_1",
      creditLedgerAccountId: "ledger_account_2",
      availableBalance: "5.00"
    });

    transactionClient.depositSettlementProof.create.mockResolvedValue({
      id: "deposit_settlement_proof_1"
    });
    transactionClient.transactionIntent.update.mockResolvedValue(undefined);
    transactionClient.auditEvent.create.mockResolvedValue(undefined);

    const result = await service.replaySettleConfirmedDepositIntent(
      "intent_1",
      "ops_1",
      "Replay missed settlement."
    );

    expect(result.settlementReused).toBe(false);
    expect(ledgerService.settleConfirmedDeposit).toHaveBeenCalled();
    expect(transactionClient.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorType: "operator",
        actorId: "ops_1",
        action: "transaction_intent.deposit.settled",
        metadata: expect.objectContaining({
          reconciliationReplay: true,
          replayReason: "deposit_settlement_reconciliation",
          note: "Replay missed settlement."
        })
      })
    });
  });
});
