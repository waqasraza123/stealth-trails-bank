import {
  BadRequestException,
  ConflictException,
  NotFoundException
} from "@nestjs/common";
import {
  BlockchainTransactionStatus,
  PolicyDecision,
  Prisma,
  TransactionIntentStatus,
  TransactionIntentType
} from "@prisma/client";
import { TransactionIntentsService } from "./transaction-intents.service";

jest.mock("@stealth-trails-bank/config/api", () => ({
  loadProductChainRuntimeConfig: () => ({
    productChainId: 8453
  })
}));

function createCustomerIntentRecord(
  overrides: Partial<{
    id: string;
    customerAccountId: string | null;
    destinationWalletId: string | null;
    chainId: number;
    requestedAmount: Prisma.Decimal;
    idempotencyKey: string;
    assetSymbol: string;
    destinationWalletAddress: string | null;
    status: TransactionIntentStatus;
    policyDecision: PolicyDecision;
    failureCode: string | null;
    failureReason: string | null;
  }> = {}
) {
  return {
    id: overrides.id ?? "intent_1",
    customerAccountId: overrides.customerAccountId ?? "account_1",
    assetId: "asset_1",
    sourceWalletId: null,
    destinationWalletId: overrides.destinationWalletId ?? "wallet_1",
    chainId: overrides.chainId ?? 8453,
    intentType: TransactionIntentType.deposit,
    status: overrides.status ?? TransactionIntentStatus.requested,
    policyDecision: overrides.policyDecision ?? PolicyDecision.pending,
    requestedAmount:
      overrides.requestedAmount ?? new Prisma.Decimal("1.25"),
    settledAmount: null,
    idempotencyKey: overrides.idempotencyKey ?? "deposit_req_1",
    failureCode: overrides.failureCode ?? null,
    failureReason: overrides.failureReason ?? null,
    createdAt: new Date("2026-04-01T10:00:00.000Z"),
    updatedAt: new Date("2026-04-01T10:00:00.000Z"),
    asset: {
      id: "asset_1",
      symbol: overrides.assetSymbol ?? "ETH",
      displayName: "Ether",
      decimals: 18,
      chainId: 8453
    },
    destinationWallet: overrides.destinationWalletAddress
      ? {
          id: "wallet_1",
          address: overrides.destinationWalletAddress
        }
      : {
          id: "wallet_1",
          address: "0x0000000000000000000000000000000000000abc"
        }
  };
}

function createInternalIntentRecord(
  overrides: Partial<{
    id: string;
    status: TransactionIntentStatus;
    policyDecision: PolicyDecision;
    requestedAmount: Prisma.Decimal;
    failureCode: string | null;
    failureReason: string | null;
    txHash: string | null;
    blockchainStatus: BlockchainTransactionStatus | null;
  }> = {}
) {
  return {
    ...createCustomerIntentRecord({
      id: overrides.id,
      status: overrides.status,
      policyDecision: overrides.policyDecision,
      requestedAmount: overrides.requestedAmount,
      failureCode: overrides.failureCode,
      failureReason: overrides.failureReason
    }),
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
            txHash: overrides.txHash ?? null,
            status: overrides.blockchainStatus,
            fromAddress: "0x0000000000000000000000000000000000000def",
            toAddress: "0x0000000000000000000000000000000000000abc",
            createdAt: new Date("2026-04-01T10:05:00.000Z"),
            updatedAt: new Date("2026-04-01T10:05:00.000Z"),
            confirmedAt: null
          }
        ]
      : []
  };
}

function createService() {
  const prismaTransactionIntentReadMock = jest.fn();
  const transactionClientTransactionIntentReadMock = jest.fn();
  const transactionIntentWriteMock = jest.fn();
  const transactionClient = {
    transactionIntent: {
      create: jest.fn(),
      update: transactionIntentWriteMock,
      updateMany: transactionIntentWriteMock,
      findFirst: transactionClientTransactionIntentReadMock,
      findUnique: transactionClientTransactionIntentReadMock
    },
    auditEvent: {
      create: jest.fn()
    },
    blockchainTransaction: {
      create: jest.fn(),
      update: jest.fn()
    }
  };

  const prismaService = {
    customerAccount: {
      findFirst: jest.fn()
    },
    asset: {
      findUnique: jest.fn()
    },
    transactionIntent: {
      findFirst: prismaTransactionIntentReadMock,
      findMany: jest.fn(),
      findUnique: prismaTransactionIntentReadMock
    },
    $transaction: jest.fn(async (callback: (client: unknown) => unknown) =>
      callback(transactionClient)
    )
  };

  const service = new TransactionIntentsService(prismaService as never, {} as never);

  return {
    service,
    prismaService,
    transactionClient
  };
}

describe("TransactionIntentsService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a new deposit intent and audit event", async () => {
    const { service, prismaService, transactionClient } = createService();

    prismaService.customerAccount.findFirst.mockResolvedValue({
      id: "account_1",
      customer: {
        id: "customer_1"
      },
      wallets: [
        {
          id: "wallet_1",
          address: "0x0000000000000000000000000000000000000abc"
        }
      ]
    });

    prismaService.asset.findUnique.mockResolvedValue({
      id: "asset_1",
      symbol: "ETH",
      displayName: "Ether",
      decimals: 18,
      chainId: 8453,
      status: "active"
    });

    prismaService.transactionIntent.findFirst.mockResolvedValue(null);

    const createdIntent = createCustomerIntentRecord();

    transactionClient.transactionIntent.create.mockResolvedValue(createdIntent);
    transactionClient.auditEvent.create.mockResolvedValue({
      id: "audit_1"
    });

    const result = await service.createDepositIntent("supabase_1", {
      idempotencyKey: "deposit_req_1",
      assetSymbol: "eth",
      amount: "1.25"
    });

    expect(result.idempotencyReused).toBe(false);
    expect(result.intent.id).toBe("intent_1");
    expect(transactionClient.transactionIntent.create).toHaveBeenCalled();
    expect(transactionClient.auditEvent.create).toHaveBeenCalled();
  });

  it("lists confirmed deposits that are ready to settle", async () => {
    const { service, prismaService } = createService();

    prismaService.transactionIntent.findMany.mockResolvedValue([
      createInternalIntentRecord({
        status: TransactionIntentStatus.confirmed,
        policyDecision: PolicyDecision.approved,
        blockchainStatus: BlockchainTransactionStatus.confirmed,
        txHash:
          "0x1111111111111111111111111111111111111111111111111111111111111111"
      })
    ]);

    const result = await service.listConfirmedDepositIntentsReadyToSettle({
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

  it("reuses an idempotent deposit intent when the request matches", async () => {
    const { service, prismaService } = createService();

    prismaService.customerAccount.findFirst.mockResolvedValue({
      id: "account_1",
      customer: {
        id: "customer_1"
      },
      wallets: [
        {
          id: "wallet_1",
          address: "0x0000000000000000000000000000000000000abc"
        }
      ]
    });

    prismaService.asset.findUnique.mockResolvedValue({
      id: "asset_1",
      symbol: "ETH",
      displayName: "Ether",
      decimals: 18,
      chainId: 8453,
      status: "active"
    });

    prismaService.transactionIntent.findFirst.mockResolvedValue(
      createCustomerIntentRecord()
    );

    const result = await service.createDepositIntent("supabase_1", {
      idempotencyKey: "deposit_req_1",
      assetSymbol: "ETH",
      amount: "1.25"
    });

    expect(result.idempotencyReused).toBe(true);
    expect(prismaService.$transaction).not.toHaveBeenCalled();
  });

  it("rejects an idempotency key that already belongs to a different request", async () => {
    const { service, prismaService } = createService();

    prismaService.customerAccount.findFirst.mockResolvedValue({
      id: "account_1",
      customer: {
        id: "customer_1"
      },
      wallets: [
        {
          id: "wallet_1",
          address: "0x0000000000000000000000000000000000000abc"
        }
      ]
    });

    prismaService.asset.findUnique.mockResolvedValue({
      id: "asset_1",
      symbol: "ETH",
      displayName: "Ether",
      decimals: 18,
      chainId: 8453,
      status: "active"
    });

    prismaService.transactionIntent.findFirst.mockResolvedValue(
      createCustomerIntentRecord({
        requestedAmount: new Prisma.Decimal("2.50")
      })
    );

    await expect(
      service.createDepositIntent("supabase_1", {
        idempotencyKey: "deposit_req_1",
        assetSymbol: "ETH",
        amount: "1.25"
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects a non-positive amount", async () => {
    const { service } = createService();

    await expect(
      service.createDepositIntent("supabase_1", {
        idempotencyKey: "deposit_req_1",
        assetSymbol: "ETH",
        amount: "0"
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("lists recent intents for the authenticated customer account", async () => {
    const { service, prismaService } = createService();

    prismaService.customerAccount.findFirst.mockResolvedValue({
      id: "account_1"
    });

    prismaService.transactionIntent.findMany.mockResolvedValue([
      createCustomerIntentRecord(),
      createCustomerIntentRecord({
        id: "intent_2",
        idempotencyKey: "deposit_req_2"
      })
    ]);

    const result = await service.listMyTransactionIntents("supabase_1", {
      limit: 2
    });

    expect(result.limit).toBe(2);
    expect(result.intents).toHaveLength(2);
  });

  it("lists pending deposit intents for operator review", async () => {
    const { service, prismaService } = createService();

    prismaService.transactionIntent.findMany.mockResolvedValue([
      createInternalIntentRecord()
    ]);

    const result = await service.listPendingDepositIntents({
      limit: 10
    });

    expect(result.limit).toBe(10);
    expect(result.intents).toHaveLength(1);
    expect(result.intents[0].customer.customerId).toBe("customer_1");
  });

  it("approves a pending deposit intent and writes an audit event", async () => {
    const { service, prismaService, transactionClient } = createService();

    prismaService.transactionIntent.findFirst.mockResolvedValue(
      createInternalIntentRecord()
    );
    transactionClient.transactionIntent.updateMany.mockResolvedValue({
      count: 1
    });
    transactionClient.transactionIntent.findFirst.mockResolvedValue(
      createInternalIntentRecord({
        status: TransactionIntentStatus.approved,
        policyDecision: PolicyDecision.approved
      })
    );
    transactionClient.auditEvent.create.mockResolvedValue({
      id: "audit_approve_1"
    });

    const result = await service.decideDepositIntent("intent_1", "ops_1", {
      decision: "approved",
      note: "Looks good."
    });

    expect(result.decision).toBe("approved");
    expect(result.intent.status).toBe(TransactionIntentStatus.approved);
    expect(result.intent.policyDecision).toBe(PolicyDecision.approved);
  });

  it("denies a pending deposit intent and writes an audit event", async () => {
    const { service, prismaService, transactionClient } = createService();

    prismaService.transactionIntent.findFirst.mockResolvedValue(
      createInternalIntentRecord()
    );
    transactionClient.transactionIntent.updateMany.mockResolvedValue({
      count: 1
    });
    transactionClient.transactionIntent.findFirst.mockResolvedValue(
      createInternalIntentRecord({
        status: TransactionIntentStatus.failed,
        policyDecision: PolicyDecision.denied,
        failureCode: "policy_denied",
        failureReason: "Proof of funds missing."
      })
    );
    transactionClient.auditEvent.create.mockResolvedValue({
      id: "audit_deny_1"
    });

    const result = await service.decideDepositIntent("intent_1", "ops_1", {
      decision: "denied",
      denialReason: "Proof of funds missing."
    });

    expect(result.decision).toBe("denied");
    expect(result.intent.status).toBe(TransactionIntentStatus.failed);
    expect(result.intent.policyDecision).toBe(PolicyDecision.denied);
    expect(result.intent.failureCode).toBe("policy_denied");
  });

  it("lists approved deposit intents ready for queueing", async () => {
    const { service, prismaService } = createService();

    prismaService.transactionIntent.findMany.mockResolvedValue([
      createInternalIntentRecord({
        status: TransactionIntentStatus.approved,
        policyDecision: PolicyDecision.approved
      })
    ]);

    const result = await service.listApprovedDepositIntents({
      limit: 10
    });

    expect(result.limit).toBe(10);
    expect(result.intents[0].status).toBe(TransactionIntentStatus.approved);
  });

  it("queues an approved deposit intent", async () => {
    const { service, prismaService, transactionClient } = createService();

    prismaService.transactionIntent.findFirst.mockResolvedValue(
      createInternalIntentRecord({
        status: TransactionIntentStatus.approved,
        policyDecision: PolicyDecision.approved
      })
    );
    transactionClient.transactionIntent.updateMany.mockResolvedValue({
      count: 1
    });
    transactionClient.transactionIntent.findFirst.mockResolvedValue(
      createInternalIntentRecord({
        status: TransactionIntentStatus.queued,
        policyDecision: PolicyDecision.approved
      })
    );
    transactionClient.auditEvent.create.mockResolvedValue({
      id: "audit_queue_1"
    });

    const result = await service.queueApprovedDepositIntent(
      "intent_1",
      "ops_1",
      { note: "Send to worker." }
    );

    expect(result.queueReused).toBe(false);
    expect(result.intent.status).toBe(TransactionIntentStatus.queued);
  });

  it("reuses queue state for an already queued deposit intent", async () => {
    const { service, prismaService } = createService();

    prismaService.transactionIntent.findFirst.mockResolvedValue(
      createInternalIntentRecord({
        status: TransactionIntentStatus.queued,
        policyDecision: PolicyDecision.approved
      })
    );

    const result = await service.queueApprovedDepositIntent(
      "intent_1",
      "ops_1",
      {}
    );

    expect(result.queueReused).toBe(true);
    expect(result.intent.status).toBe(TransactionIntentStatus.queued);
  });

  it("lists queued deposit intents for worker pickup", async () => {
    const { service, prismaService } = createService();

    prismaService.transactionIntent.findMany.mockResolvedValue([
      createInternalIntentRecord({
        status: TransactionIntentStatus.queued,
        policyDecision: PolicyDecision.approved
      })
    ]);

    const result = await service.listQueuedDepositIntents({
      limit: 10
    });

    expect(result.limit).toBe(10);
    expect(result.intents[0].status).toBe(TransactionIntentStatus.queued);
  });

  it("records a deposit broadcast and creates a blockchain transaction", async () => {
    const { service, prismaService, transactionClient } = createService();

    prismaService.transactionIntent.findFirst.mockResolvedValue(
      createInternalIntentRecord({
        status: TransactionIntentStatus.queued,
        policyDecision: PolicyDecision.approved
      })
    );
    transactionClient.transactionIntent.findFirst.mockResolvedValueOnce(
      createInternalIntentRecord({
        status: TransactionIntentStatus.queued,
        policyDecision: PolicyDecision.approved
      })
    );
    transactionClient.transactionIntent.updateMany.mockResolvedValue({
      count: 1
    });
    transactionClient.blockchainTransaction.create.mockResolvedValue({
      id: "chain_tx_1"
    });
    transactionClient.auditEvent.create.mockResolvedValue({
      id: "audit_broadcast_1"
    });
    transactionClient.transactionIntent.findFirst.mockResolvedValueOnce(
      createInternalIntentRecord({
        status: TransactionIntentStatus.broadcast,
        policyDecision: PolicyDecision.approved,
        txHash:
          "0x1111111111111111111111111111111111111111111111111111111111111111",
        blockchainStatus: BlockchainTransactionStatus.broadcast
      })
    );

    const result = await service.recordDepositBroadcast(
      "intent_1",
      "worker_1",
      {
        txHash:
          "0x1111111111111111111111111111111111111111111111111111111111111111",
        fromAddress: "0x0000000000000000000000000000000000000def",
        toAddress: "0x0000000000000000000000000000000000000abc"
      }
    );

    expect(result.broadcastReused).toBe(false);
    expect(result.intent.status).toBe(TransactionIntentStatus.broadcast);
    expect(transactionClient.blockchainTransaction.create).toHaveBeenCalled();
  });

  it("records deposit execution failure", async () => {
    const { service, prismaService, transactionClient } = createService();

    prismaService.transactionIntent.findFirst.mockResolvedValue(
      createInternalIntentRecord({
        status: TransactionIntentStatus.broadcast,
        policyDecision: PolicyDecision.approved,
        txHash:
          "0x1111111111111111111111111111111111111111111111111111111111111111",
        blockchainStatus: BlockchainTransactionStatus.broadcast
      })
    );
    transactionClient.transactionIntent.findFirst.mockResolvedValueOnce(
      createInternalIntentRecord({
        status: TransactionIntentStatus.broadcast,
        policyDecision: PolicyDecision.approved,
        txHash:
          "0x1111111111111111111111111111111111111111111111111111111111111111",
        blockchainStatus: BlockchainTransactionStatus.broadcast
      })
    );
    transactionClient.blockchainTransaction.update.mockResolvedValue({
      id: "chain_tx_1"
    });
    transactionClient.transactionIntent.updateMany.mockResolvedValue({
      count: 1
    });
    transactionClient.auditEvent.create.mockResolvedValue({
      id: "audit_fail_1"
    });
    transactionClient.transactionIntent.findFirst.mockResolvedValueOnce(
      createInternalIntentRecord({
        status: TransactionIntentStatus.failed,
        policyDecision: PolicyDecision.approved,
        failureCode: "broadcast_failed",
        failureReason: "RPC submission failed.",
        txHash:
          "0x1111111111111111111111111111111111111111111111111111111111111111",
        blockchainStatus: BlockchainTransactionStatus.failed
      })
    );

    const result = await service.failDepositIntentExecution(
      "intent_1",
      "worker_1",
      {
        failureCode: "broadcast_failed",
        failureReason: "RPC submission failed.",
        txHash:
          "0x1111111111111111111111111111111111111111111111111111111111111111"
      }
    );

    expect(result.failureReused).toBe(false);
    expect(result.intent.status).toBe(TransactionIntentStatus.failed);
    expect(result.intent.failureCode).toBe("broadcast_failed");
    expect(result.intent.failureReason).toBe("RPC submission failed.");
  });

  it("rejects decisioning when the deposit intent is no longer pending", async () => {
    const { service, prismaService } = createService();

    prismaService.transactionIntent.findFirst.mockResolvedValue(
      createInternalIntentRecord({
        status: TransactionIntentStatus.approved,
        policyDecision: PolicyDecision.approved
      })
    );

    await expect(
      service.decideDepositIntent("intent_1", "ops_1", {
        decision: "approved"
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("fails when the authenticated user does not have a customer account projection", async () => {
    const { service, prismaService } = createService();

    prismaService.customerAccount.findFirst.mockResolvedValue(null);

    await expect(
      service.listMyTransactionIntents("missing_user", {})
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
