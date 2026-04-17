import {
  BlockchainTransactionStatus,
  PolicyDecision,
  TransactionIntentStatus
} from "@prisma/client";
import { WithdrawalSettlementReconciliationService } from "./withdrawal-settlement-reconciliation.service";

function buildRecord(
  overrides: {
    status?: TransactionIntentStatus;
    blockchainStatus?: BlockchainTransactionStatus | null;
    hasLedgerJournal?: boolean;
    settledAmount?: string | null;
  } = {}
) {
  const blockchainTransactions =
    overrides.blockchainStatus === null
      ? []
      : [
          {
            id: "tx_1",
            txHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
            status:
              overrides.blockchainStatus ?? BlockchainTransactionStatus.broadcast,
            fromAddress: "0x0000000000000000000000000000000000000def",
            toAddress: "0x0000000000000000000000000000000000000abc",
            createdAt: new Date("2026-04-01T00:00:00.000Z"),
            updatedAt: new Date("2026-04-01T00:00:00.000Z"),
            confirmedAt:
              overrides.blockchainStatus === BlockchainTransactionStatus.confirmed
                ? new Date("2026-04-01T00:05:00.000Z")
                : null
          }
        ];

  return {
    id: "intent_1",
    customerAccountId: "account_1",
    sourceWalletId: "wallet_1",
    externalAddress: "0x0000000000000000000000000000000000000abc",
    chainId: 8453,
    status: overrides.status ?? TransactionIntentStatus.broadcast,
    policyDecision: PolicyDecision.approved,
    requestedAmount: {
      toString: () => "30"
    },
    settledAmount:
      overrides.settledAmount === undefined
        ? null
        : overrides.settledAmount === null
          ? null
          : {
              toString: () => overrides.settledAmount as string
            },
    createdAt: new Date("2026-04-01T00:00:00.000Z"),
    updatedAt: new Date("2026-04-01T00:00:00.000Z"),
    asset: {
      id: "asset_1",
      symbol: "USDC",
      displayName: "USD Coin",
      decimals: 6,
      chainId: 8453
    },
    sourceWallet: {
      id: "wallet_1",
      address: "0x0000000000000000000000000000000000000def"
    },
    customerAccount: {
      id: "account_1",
      customerId: "customer_1",
      customer: {
        id: "customer_1",
        supabaseUserId: "supabase_1",
        email: "user@example.com",
        firstName: "Waqas",
        lastName: "Raza"
      }
    },
    blockchainTransactions,
    ledgerJournals: overrides.hasLedgerJournal
      ? [
          {
            id: "journal_1",
            journalType: "withdrawal_settlement",
            postedAt: new Date("2026-04-01T00:10:00.000Z"),
            createdAt: new Date("2026-04-01T00:10:00.000Z")
          }
        ]
      : []
  };
}

function createService(records: any[] = []) {
  const prismaService = {
    transactionIntent: {
      findMany: jest.fn().mockResolvedValue(records),
      findFirst: jest.fn().mockImplementation(({ where }: any) => {
        const intentId = where.id;
        return Promise.resolve(
          records.find((record) => record.id === intentId) ?? null
        );
      })
    }
  } as any;

  const withdrawalIntentsService = {
    replayConfirmWithdrawalIntent: jest.fn(),
    replaySettleConfirmedWithdrawalIntent: jest.fn()
  } as any;

  const reviewCasesService = {} as never;

  const service = new WithdrawalSettlementReconciliationService(
    prismaService as never,
    withdrawalIntentsService as never,
    reviewCasesService
  );

  return {
    service,
    prismaService,
    withdrawalIntentsService
  };
}

describe("WithdrawalSettlementReconciliationService", () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("classifies replayable and healthy withdrawal settlement states", async () => {
    const records = [
      buildRecord({
        status: TransactionIntentStatus.broadcast,
        blockchainStatus: BlockchainTransactionStatus.confirmed,
        hasLedgerJournal: false
      }),
      buildRecord({
        status: TransactionIntentStatus.confirmed,
        blockchainStatus: BlockchainTransactionStatus.confirmed,
        hasLedgerJournal: false
      }),
      buildRecord({
        status: TransactionIntentStatus.settled,
        blockchainStatus: BlockchainTransactionStatus.confirmed,
        hasLedgerJournal: true,
        settledAmount: "30"
      })
    ];

    records[1].id = "intent_2";
    records[2].id = "intent_3";

    const { service } = createService(records);

    const result = await service.listWithdrawalSettlementReconciliation({});

    expect(result.summary.ready_for_confirm_replay).toBe(1);
    expect(result.summary.ready_for_settle_replay).toBe(1);
    expect(result.summary.healthy_settled).toBe(1);
  });

  it("replays confirm only when the classification allows it", async () => {
    const record = buildRecord({
      status: TransactionIntentStatus.broadcast,
      blockchainStatus: BlockchainTransactionStatus.confirmed,
      hasLedgerJournal: false
    });

    const { service, withdrawalIntentsService } = createService([record]);

    withdrawalIntentsService.replayConfirmWithdrawalIntent.mockResolvedValue({
      confirmReused: false
    });

    await service.replayConfirm("intent_1", "ops_1", {
      note: "Replay missed confirm."
    });

    expect(
      withdrawalIntentsService.replayConfirmWithdrawalIntent
    ).toHaveBeenCalledWith("intent_1", "ops_1", "Replay missed confirm.");
  });

  it("rejects settle replay when the classification is not settle-replayable", async () => {
    const record = buildRecord({
      status: TransactionIntentStatus.settled,
      blockchainStatus: BlockchainTransactionStatus.confirmed,
      hasLedgerJournal: true,
      settledAmount: "30"
    });

    const { service } = createService([record]);

    await expect(
      service.replaySettle("intent_1", "ops_1", {})
    ).rejects.toThrow(
      "Withdrawal transaction intent is not in a state that supports settle replay."
    );
  });
});
