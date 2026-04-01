import {
  BadRequestException,
  ConflictException,
  NotFoundException
} from "@nestjs/common";
import {
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

function createInternalReviewIntentRecord(
  overrides: Partial<{
    id: string;
    status: TransactionIntentStatus;
    policyDecision: PolicyDecision;
    requestedAmount: Prisma.Decimal;
    failureCode: string | null;
    failureReason: string | null;
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
    }
  };
}

function createService() {
  const transactionClient = {
    transactionIntent: {
      create: jest.fn(),
      updateMany: jest.fn(),
      findFirst: jest.fn()
    },
    auditEvent: {
      create: jest.fn()
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
      findFirst: jest.fn(),
      findMany: jest.fn()
    },
    $transaction: jest.fn(async (callback: (client: unknown) => unknown) =>
      callback(transactionClient)
    )
  };

  const service = new TransactionIntentsService(prismaService as never);

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
    expect(transactionClient.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        customerId: "customer_1",
        actorType: "customer",
        actorId: "supabase_1",
        action: "transaction_intent.deposit.requested",
        targetType: "TransactionIntent",
        targetId: "intent_1"
      })
    });
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
    expect(result.intent.id).toBe("intent_1");
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
      createInternalReviewIntentRecord()
    ]);

    const result = await service.listPendingDepositIntents({
      limit: 10
    });

    expect(result.limit).toBe(10);
    expect(result.intents).toHaveLength(1);
    expect(result.intents[0].customer.customerId).toBe("customer_1");
    expect(prismaService.transactionIntent.findMany).toHaveBeenCalledWith({
      where: {
        intentType: TransactionIntentType.deposit,
        chainId: 8453,
        status: TransactionIntentStatus.requested,
        policyDecision: PolicyDecision.pending
      },
      orderBy: {
        createdAt: "asc"
      },
      take: 10,
      include: {
        asset: {
          select: {
            id: true,
            symbol: true,
            displayName: true,
            decimals: true,
            chainId: true
          }
        },
        destinationWallet: {
          select: {
            id: true,
            address: true
          }
        },
        customerAccount: {
          select: {
            id: true,
            customerId: true,
            customer: {
              select: {
                id: true,
                supabaseUserId: true,
                email: true,
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });
  });

  it("approves a pending deposit intent and writes an audit event", async () => {
    const { service, prismaService, transactionClient } = createService();

    prismaService.transactionIntent.findFirst.mockResolvedValue(
      createInternalReviewIntentRecord()
    );

    const approvedIntent = createInternalReviewIntentRecord({
      status: TransactionIntentStatus.approved,
      policyDecision: PolicyDecision.approved
    });

    transactionClient.transactionIntent.updateMany.mockResolvedValue({
      count: 1
    });
    transactionClient.transactionIntent.findFirst.mockResolvedValue(
      approvedIntent
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
    expect(transactionClient.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        customerId: "customer_1",
        actorType: "operator",
        actorId: "ops_1",
        action: "transaction_intent.deposit.approved",
        targetType: "TransactionIntent",
        targetId: "intent_1"
      })
    });
  });

  it("denies a pending deposit intent and writes an audit event", async () => {
    const { service, prismaService, transactionClient } = createService();

    prismaService.transactionIntent.findFirst.mockResolvedValue(
      createInternalReviewIntentRecord()
    );

    const deniedIntent = createInternalReviewIntentRecord({
      status: TransactionIntentStatus.failed,
      policyDecision: PolicyDecision.denied,
      failureCode: "policy_denied",
      failureReason: "Proof of funds missing."
    });

    transactionClient.transactionIntent.updateMany.mockResolvedValue({
      count: 1
    });
    transactionClient.transactionIntent.findFirst.mockResolvedValue(
      deniedIntent
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
    expect(result.intent.failureReason).toBe("Proof of funds missing.");
    expect(transactionClient.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorType: "operator",
        actorId: "ops_1",
        action: "transaction_intent.deposit.denied"
      })
    });
  });

  it("rejects a deny decision without a denial reason", async () => {
    const { service, prismaService } = createService();

    prismaService.transactionIntent.findFirst.mockResolvedValue(
      createInternalReviewIntentRecord()
    );

    await expect(
      service.decideDepositIntent("intent_1", "ops_1", {
        decision: "denied"
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects decisioning when the deposit intent is no longer pending", async () => {
    const { service, prismaService } = createService();

    prismaService.transactionIntent.findFirst.mockResolvedValue(
      createInternalReviewIntentRecord({
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
