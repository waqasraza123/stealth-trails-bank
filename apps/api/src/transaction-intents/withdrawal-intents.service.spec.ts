import { ConflictException } from "@nestjs/common";
import {
  BlockchainTransactionStatus,
  PolicyDecision,
  Prisma,
  TransactionIntentStatus,
  TransactionIntentType
} from "@prisma/client";
import { LedgerService } from "../ledger/ledger.service";
import { PrismaService } from "../prisma/prisma.service";
import { WithdrawalIntentsService } from "./withdrawal-intents.service";

function buildCustomerIntentRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "intent_1",
    customerAccountId: "account_1",
    assetId: "asset_1",
    sourceWalletId: "wallet_1",
    destinationWalletId: null,
    externalAddress: "0x0000000000000000000000000000000000000abc",
    chainId: 8453,
    intentType: TransactionIntentType.withdrawal,
    status: TransactionIntentStatus.requested,
    policyDecision: PolicyDecision.pending,
    requestedAmount: new Prisma.Decimal("30"),
    settledAmount: null,
    idempotencyKey: "withdraw_req_1",
    failureCode: null,
    failureReason: null,
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
    ...overrides
  };
}

function buildInternalIntentRecord(overrides: Record<string, unknown> = {}) {
  return {
    ...buildCustomerIntentRecord(overrides),
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
    blockchainTransactions: [],
    ...overrides
  };
}

function createService() {
  const prismaService = {
    transactionIntent: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    },
    auditEvent: {
      create: jest.fn()
    },
    blockchainTransaction: {
      create: jest.fn(),
      update: jest.fn()
    },
    ledgerJournal: {
      findUnique: jest.fn()
    },
    $transaction: jest.fn()
  } as unknown as PrismaService;

  const ledgerService = {
    reserveWithdrawalBalance: jest.fn(),
    releaseWithdrawalReservation: jest.fn(),
    settleConfirmedWithdrawal: jest.fn()
  } as unknown as LedgerService;

  const service = new WithdrawalIntentsService(prismaService, ledgerService);

  return {
    service,
    prismaService,
    ledgerService
  };
}

describe("WithdrawalIntentsService", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it("creates a withdrawal intent and reserves balance", async () => {
    const { service, prismaService, ledgerService } = createService();

    jest
      .spyOn(service as any, "resolveWithdrawalIntentContext")
      .mockResolvedValue({
        customerId: "customer_1",
        customerAccountId: "account_1",
        sourceWalletId: "wallet_1",
        sourceWalletAddress: "0x0000000000000000000000000000000000000def",
        externalAddress: "0x0000000000000000000000000000000000000abc",
        assetId: "asset_1",
        assetSymbol: "USDC",
        assetDisplayName: "USD Coin",
        assetDecimals: 6
      });

    jest
      .spyOn(service as any, "findIntentByIdempotencyKey")
      .mockResolvedValue(null);

    const transaction = {
      transactionIntent: {
        create: jest.fn().mockResolvedValue(buildCustomerIntentRecord())
      },
      auditEvent: {
        create: jest.fn().mockResolvedValue(undefined)
      }
    };

    (ledgerService.reserveWithdrawalBalance as jest.Mock).mockResolvedValue({
      availableBalance: "70",
      pendingBalance: "30"
    });

    (prismaService.$transaction as jest.Mock).mockImplementation(
      async (callback: (transactionClient: any) => Promise<unknown>) =>
        callback(transaction)
    );

    const result = await service.createWithdrawalIntent("supabase_1", {
      idempotencyKey: "withdraw_req_1",
      assetSymbol: "usdc",
      amount: "30",
      destinationAddress: "0x0000000000000000000000000000000000000abc"
    });

    expect(ledgerService.reserveWithdrawalBalance).toHaveBeenCalled();
    expect(result.idempotencyReused).toBe(false);
    expect(result.intent.intentType).toBe(TransactionIntentType.withdrawal);
    expect(result.intent.externalAddress).toBe(
      "0x0000000000000000000000000000000000000abc"
    );
  });

  it("lists confirmed withdrawals that are ready to settle", async () => {
    const { service, prismaService } = createService();

    (prismaService.transactionIntent.findMany as jest.Mock).mockResolvedValue([
      buildInternalIntentRecord({
        status: TransactionIntentStatus.confirmed,
        policyDecision: PolicyDecision.approved,
        blockchainTransactions: [
          {
            id: "tx_1",
            txHash:
              "0x1111111111111111111111111111111111111111111111111111111111111111",
            status: BlockchainTransactionStatus.confirmed,
            fromAddress: "0x0000000000000000000000000000000000000def",
            toAddress: "0x0000000000000000000000000000000000000abc",
            createdAt: new Date("2026-04-01T00:05:00.000Z"),
            updatedAt: new Date("2026-04-01T00:05:00.000Z"),
            confirmedAt: new Date("2026-04-01T00:05:00.000Z")
          }
        ]
      })
    ]);

    const result = await service.listConfirmedWithdrawalIntentsReadyToSettle({
      limit: 5
    });

    expect(result.limit).toBe(5);
    expect(result.intents).toHaveLength(1);
    expect(result.intents[0]?.status).toBe(TransactionIntentStatus.confirmed);
    expect(prismaService.transactionIntent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: TransactionIntentStatus.confirmed,
          policyDecision: PolicyDecision.approved,
          chainId: 8453,
          blockchainTransactions: {
            some: {
              status: BlockchainTransactionStatus.confirmed
            }
          }
        }),
        take: 5
      })
    );
  });

  it("reuses an idempotent withdrawal intent when the request matches", async () => {
    const { service } = createService();

    jest
      .spyOn(service as any, "resolveWithdrawalIntentContext")
      .mockResolvedValue({
        customerId: "customer_1",
        customerAccountId: "account_1",
        sourceWalletId: "wallet_1",
        sourceWalletAddress: "0x0000000000000000000000000000000000000def",
        externalAddress: "0x0000000000000000000000000000000000000abc",
        assetId: "asset_1",
        assetSymbol: "USDC",
        assetDisplayName: "USD Coin",
        assetDecimals: 6
      });

    jest
      .spyOn(service as any, "findIntentByIdempotencyKey")
      .mockResolvedValue(buildCustomerIntentRecord());

    const result = await service.createWithdrawalIntent("supabase_1", {
      idempotencyKey: "withdraw_req_1",
      assetSymbol: "USDC",
      amount: "30",
      destinationAddress: "0x0000000000000000000000000000000000000abc"
    });

    expect(result.idempotencyReused).toBe(true);
  });

  it("denies a pending withdrawal intent and releases the reservation", async () => {
    const { service, prismaService, ledgerService } = createService();

    const existingIntent = buildInternalIntentRecord();

    jest
      .spyOn(service as any, "findWithdrawalIntentForReview")
      .mockResolvedValue(existingIntent);

    const refreshedIntent = buildInternalIntentRecord({
      status: TransactionIntentStatus.failed,
      policyDecision: PolicyDecision.denied,
      failureCode: "policy_denied",
      failureReason: "Manual review rejected."
    });

    const transaction = {
      transactionIntent: {
        update: jest.fn().mockResolvedValue(undefined),
        findFirst: jest.fn().mockResolvedValue(refreshedIntent)
      },
      auditEvent: {
        create: jest.fn().mockResolvedValue(undefined)
      }
    };

    (ledgerService.releaseWithdrawalReservation as jest.Mock).mockResolvedValue({
      availableBalance: "100",
      pendingBalance: "0"
    });

    (prismaService.$transaction as jest.Mock).mockImplementation(
      async (callback: (transactionClient: any) => Promise<unknown>) =>
        callback(transaction)
    );

    const result = await service.decideWithdrawalIntent("intent_1", "ops_1", {
      decision: "denied",
      denialReason: "Manual review rejected.",
      note: "Release the reserved balance."
    });

    expect(ledgerService.releaseWithdrawalReservation).toHaveBeenCalled();
    expect(result.intent.status).toBe(TransactionIntentStatus.failed);
    expect(result.decision).toBe("denied");
  });

  it("records a withdrawal broadcast with the reserved source and destination addresses", async () => {
    const { service, prismaService } = createService();

    const existingIntent = buildInternalIntentRecord({
      status: TransactionIntentStatus.queued,
      policyDecision: PolicyDecision.approved
    });

    jest
      .spyOn(service as any, "findWithdrawalIntentForReview")
      .mockResolvedValue(existingIntent);

    const refreshedIntent = buildInternalIntentRecord({
      status: TransactionIntentStatus.broadcast,
      policyDecision: PolicyDecision.approved,
      blockchainTransactions: [
        {
          id: "tx_1",
          txHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
          status: BlockchainTransactionStatus.broadcast,
          fromAddress: "0x0000000000000000000000000000000000000def",
          toAddress: "0x0000000000000000000000000000000000000abc",
          createdAt: new Date("2026-04-01T00:00:00.000Z"),
          updatedAt: new Date("2026-04-01T00:00:00.000Z"),
          confirmedAt: null
        }
      ]
    });

    const transaction = {
      transactionIntent: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(existingIntent)
          .mockResolvedValueOnce(refreshedIntent),
        update: jest.fn().mockResolvedValue(undefined)
      },
      blockchainTransaction: {
        create: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue(undefined)
      },
      auditEvent: {
        create: jest.fn().mockResolvedValue(undefined)
      }
    };

    (prismaService.$transaction as jest.Mock).mockImplementation(
      async (callback: (transactionClient: any) => Promise<unknown>) =>
        callback(transaction)
    );

    const result = await service.recordWithdrawalBroadcast("intent_1", "worker_1", {
      txHash:
        "0x1111111111111111111111111111111111111111111111111111111111111111"
    });

    expect(result.intent.status).toBe(TransactionIntentStatus.broadcast);
    expect(result.broadcastReused).toBe(false);
  });

  it("records a withdrawal broadcast from the operator custody surface", async () => {
    const { service, prismaService } = createService();

    const existingIntent = buildInternalIntentRecord({
      status: TransactionIntentStatus.queued,
      policyDecision: PolicyDecision.approved
    });

    jest
      .spyOn(service as any, "findWithdrawalIntentForReview")
      .mockResolvedValue(existingIntent);

    const refreshedIntent = buildInternalIntentRecord({
      status: TransactionIntentStatus.broadcast,
      policyDecision: PolicyDecision.approved,
      blockchainTransactions: [
        {
          id: "tx_1",
          txHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
          status: BlockchainTransactionStatus.broadcast,
          fromAddress: "0x0000000000000000000000000000000000000def",
          toAddress: "0x0000000000000000000000000000000000000abc",
          createdAt: new Date("2026-04-01T00:00:00.000Z"),
          updatedAt: new Date("2026-04-01T00:00:00.000Z"),
          confirmedAt: null
        }
      ]
    });

    const transaction = {
      transactionIntent: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(existingIntent)
          .mockResolvedValueOnce(refreshedIntent),
        update: jest.fn().mockResolvedValue(undefined)
      },
      blockchainTransaction: {
        create: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue(undefined)
      },
      auditEvent: {
        create: jest.fn().mockResolvedValue(undefined)
      }
    };

    (prismaService.$transaction as jest.Mock).mockImplementation(
      async (callback: (transactionClient: any) => Promise<unknown>) =>
        callback(transaction)
    );

    const result = await service.recordWithdrawalBroadcastByOperator(
      "intent_1",
      "ops_1",
      {
        txHash:
          "0x1111111111111111111111111111111111111111111111111111111111111111"
      }
    );

    expect(transaction.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorType: "operator",
          actorId: "ops_1",
          metadata: expect.objectContaining({
            executionChannel: "manual_custody"
          })
        })
      })
    );
    expect(result.intent.status).toBe(TransactionIntentStatus.broadcast);
    expect(result.broadcastReused).toBe(false);
  });

  it("records withdrawal execution failure and releases the reservation", async () => {
    const { service, prismaService, ledgerService } = createService();

    const existingIntent = buildInternalIntentRecord({
      status: TransactionIntentStatus.broadcast,
      policyDecision: PolicyDecision.approved,
      blockchainTransactions: [
        {
          id: "tx_1",
          txHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
          status: BlockchainTransactionStatus.broadcast,
          fromAddress: "0x0000000000000000000000000000000000000def",
          toAddress: "0x0000000000000000000000000000000000000abc",
          createdAt: new Date("2026-04-01T00:00:00.000Z"),
          updatedAt: new Date("2026-04-01T00:00:00.000Z"),
          confirmedAt: null
        }
      ]
    });

    jest
      .spyOn(service as any, "findWithdrawalIntentForReview")
      .mockResolvedValue(existingIntent);

    const refreshedIntent = buildInternalIntentRecord({
      status: TransactionIntentStatus.failed,
      policyDecision: PolicyDecision.approved,
      failureCode: "broadcast_failed",
      failureReason: "RPC submission failed.",
      blockchainTransactions: [
        {
          id: "tx_1",
          txHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
          status: BlockchainTransactionStatus.failed,
          fromAddress: "0x0000000000000000000000000000000000000def",
          toAddress: "0x0000000000000000000000000000000000000abc",
          createdAt: new Date("2026-04-01T00:00:00.000Z"),
          updatedAt: new Date("2026-04-01T00:00:00.000Z"),
          confirmedAt: null
        }
      ]
    });

    const transaction = {
      transactionIntent: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(existingIntent)
          .mockResolvedValueOnce(refreshedIntent),
        update: jest.fn().mockResolvedValue(undefined)
      },
      blockchainTransaction: {
        update: jest.fn().mockResolvedValue(undefined),
        create: jest.fn().mockResolvedValue(undefined)
      },
      auditEvent: {
        create: jest.fn().mockResolvedValue(undefined)
      }
    };

    (ledgerService.releaseWithdrawalReservation as jest.Mock).mockResolvedValue({
      availableBalance: "100",
      pendingBalance: "0"
    });

    (prismaService.$transaction as jest.Mock).mockImplementation(
      async (callback: (transactionClient: any) => Promise<unknown>) =>
        callback(transaction)
    );

    const result = await service.failWithdrawalIntentExecution(
      "intent_1",
      "worker_1",
      {
        failureCode: "broadcast_failed",
        failureReason: "RPC submission failed.",
        txHash:
          "0x1111111111111111111111111111111111111111111111111111111111111111"
      }
    );

    expect(ledgerService.releaseWithdrawalReservation).toHaveBeenCalled();
    expect(result.intent.status).toBe(TransactionIntentStatus.failed);
  });

  it("settles a confirmed withdrawal through ledger and pending balance reduction", async () => {
    const { service, prismaService, ledgerService } = createService();

    const existingIntent = buildInternalIntentRecord({
      status: TransactionIntentStatus.confirmed,
      policyDecision: PolicyDecision.approved,
      blockchainTransactions: [
        {
          id: "tx_1",
          txHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
          status: BlockchainTransactionStatus.confirmed,
          fromAddress: "0x0000000000000000000000000000000000000def",
          toAddress: "0x0000000000000000000000000000000000000abc",
          createdAt: new Date("2026-04-01T00:00:00.000Z"),
          updatedAt: new Date("2026-04-01T00:00:00.000Z"),
          confirmedAt: new Date("2026-04-01T00:05:00.000Z")
        }
      ]
    });

    jest
      .spyOn(service as any, "findWithdrawalIntentForReview")
      .mockResolvedValue(existingIntent);

    (prismaService.ledgerJournal.findUnique as jest.Mock).mockResolvedValue(null);

    const refreshedIntent = buildInternalIntentRecord({
      status: TransactionIntentStatus.settled,
      policyDecision: PolicyDecision.approved,
      settledAmount: new Prisma.Decimal("30"),
      blockchainTransactions: existingIntent.blockchainTransactions
    });

    const transaction = {
      transactionIntent: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(existingIntent)
          .mockResolvedValueOnce(refreshedIntent),
        update: jest.fn().mockResolvedValue(undefined)
      },
      auditEvent: {
        create: jest.fn().mockResolvedValue(undefined)
      }
    };

    (ledgerService.settleConfirmedWithdrawal as jest.Mock).mockResolvedValue({
      ledgerJournalId: "journal_1",
      debitLedgerAccountId: "liability_account_1",
      creditLedgerAccountId: "outbound_account_1",
      availableBalance: "70",
      pendingBalance: "0"
    });

    (prismaService.$transaction as jest.Mock).mockImplementation(
      async (callback: (transactionClient: any) => Promise<unknown>) =>
        callback(transaction)
    );

    const result = await service.settleConfirmedWithdrawalIntent(
      "intent_1",
      "worker_1",
      {
        note: "Confirmed withdrawal posted into ledger."
      }
    );

    expect(ledgerService.settleConfirmedWithdrawal).toHaveBeenCalled();
    expect(result.intent.status).toBe(TransactionIntentStatus.settled);
    expect(result.settlementReused).toBe(false);
  });

  it("confirms a broadcast withdrawal from the operator custody surface", async () => {
    const { service, prismaService } = createService();

    const existingIntent = buildInternalIntentRecord({
      status: TransactionIntentStatus.broadcast,
      policyDecision: PolicyDecision.approved,
      blockchainTransactions: [
        {
          id: "tx_1",
          txHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
          status: BlockchainTransactionStatus.broadcast,
          fromAddress: "0x0000000000000000000000000000000000000def",
          toAddress: "0x0000000000000000000000000000000000000abc",
          createdAt: new Date("2026-04-01T00:00:00.000Z"),
          updatedAt: new Date("2026-04-01T00:00:00.000Z"),
          confirmedAt: null
        }
      ]
    });

    jest
      .spyOn(service as any, "findWithdrawalIntentForReview")
      .mockResolvedValue(existingIntent);

    const refreshedIntent = buildInternalIntentRecord({
      status: TransactionIntentStatus.confirmed,
      policyDecision: PolicyDecision.approved,
      blockchainTransactions: [
        {
          id: "tx_1",
          txHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
          status: BlockchainTransactionStatus.confirmed,
          fromAddress: "0x0000000000000000000000000000000000000def",
          toAddress: "0x0000000000000000000000000000000000000abc",
          createdAt: new Date("2026-04-01T00:00:00.000Z"),
          updatedAt: new Date("2026-04-01T00:05:00.000Z"),
          confirmedAt: new Date("2026-04-01T00:05:00.000Z")
        }
      ]
    });

    const transaction = {
      transactionIntent: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(existingIntent)
          .mockResolvedValueOnce(refreshedIntent),
        update: jest.fn().mockResolvedValue(undefined)
      },
      blockchainTransaction: {
        update: jest.fn().mockResolvedValue(undefined)
      },
      auditEvent: {
        create: jest.fn().mockResolvedValue(undefined)
      }
    };

    (prismaService.$transaction as jest.Mock).mockImplementation(
      async (callback: (transactionClient: any) => Promise<unknown>) =>
        callback(transaction)
    );

    const result = await service.confirmWithdrawalIntentByOperator(
      "intent_1",
      "ops_1",
      {
        txHash:
          "0x1111111111111111111111111111111111111111111111111111111111111111",
        note: "Custody desk confirmed on-chain inclusion."
      }
    );

    expect(transaction.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorType: "operator",
          actorId: "ops_1",
          metadata: expect.objectContaining({
            executionChannel: "manual_custody",
            note: "Custody desk confirmed on-chain inclusion."
          })
        })
      })
    );
    expect(result.intent.status).toBe(TransactionIntentStatus.confirmed);
    expect(result.confirmReused).toBe(false);
  });

  it("rejects settlement when the latest blockchain transaction is not confirmed", async () => {
    const { service } = createService();

    const existingIntent = buildInternalIntentRecord({
      status: TransactionIntentStatus.confirmed,
      policyDecision: PolicyDecision.approved,
      blockchainTransactions: [
        {
          id: "tx_1",
          txHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
          status: BlockchainTransactionStatus.broadcast,
          fromAddress: "0x0000000000000000000000000000000000000def",
          toAddress: "0x0000000000000000000000000000000000000abc",
          createdAt: new Date("2026-04-01T00:00:00.000Z"),
          updatedAt: new Date("2026-04-01T00:00:00.000Z"),
          confirmedAt: null
        }
      ]
    });

    jest
      .spyOn(service as any, "findWithdrawalIntentForReview")
      .mockResolvedValue(existingIntent);

    await expect(
      service.settleConfirmedWithdrawalIntent("intent_1", "worker_1", {})
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
