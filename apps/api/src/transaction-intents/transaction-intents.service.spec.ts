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

const loadDepositRiskPolicyRuntimeConfigMock = jest.fn();

jest.mock("@stealth-trails-bank/config/api", () => ({
  loadProductChainRuntimeConfig: () => ({
    productChainId: 8453
  }),
  loadDepositRiskPolicyRuntimeConfig: (
    env?: Record<string, string | undefined>
  ) => loadDepositRiskPolicyRuntimeConfigMock(env),
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
    manualInterventionReviewCaseId: string | null;
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
    manualInterventionReviewCaseId:
      overrides.manualInterventionReviewCaseId ?? null,
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
    fromAddress: string | null;
    toAddress: string | null;
    manualInterventionReviewCaseId: string | null;
  }> = {}
) {
  return {
    ...createCustomerIntentRecord({
      id: overrides.id,
      status: overrides.status,
      policyDecision: overrides.policyDecision,
      requestedAmount: overrides.requestedAmount,
      failureCode: overrides.failureCode,
      failureReason: overrides.failureReason,
      manualInterventionReviewCaseId: overrides.manualInterventionReviewCaseId
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
            fromAddress:
              "fromAddress" in overrides
                ? (overrides.fromAddress ?? null)
                : "0x0000000000000000000000000000000000000def",
            toAddress:
              "toAddress" in overrides
                ? (overrides.toAddress ?? null)
                : "0x0000000000000000000000000000000000000abc",
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
    ledgerJournal: {
      findUnique: jest.fn()
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

  const reviewCasesService = {
    openOrReuseReviewCase: jest.fn()
  };

  const service = new TransactionIntentsService(
    prismaService as never,
    {} as never,
    reviewCasesService as never
  );

  return {
    service,
    prismaService,
    transactionClient,
    reviewCasesService
  };
}

describe("TransactionIntentsService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    loadDepositRiskPolicyRuntimeConfigMock.mockReturnValue({
      autoApproveThresholds: []
    });
  });

  it("creates a new deposit intent and audit event", async () => {
    const { service, prismaService, transactionClient, reviewCasesService } =
      createService();

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

    const createdIntent = createCustomerIntentRecord({
      status: TransactionIntentStatus.review_required,
      policyDecision: PolicyDecision.review_required
    });

    transactionClient.transactionIntent.create.mockResolvedValue(createdIntent);
    reviewCasesService.openOrReuseReviewCase.mockResolvedValue({
      reviewCase: {
        id: "review_case_1"
      },
      reviewCaseReused: false
    });
    transactionClient.reviewCase.findUnique.mockResolvedValue({
      id: "review_case_1",
      customerId: "customer_1",
      customerAccountId: "account_1",
      transactionIntentId: "intent_1",
      type: "manual_intervention",
      status: "open",
      assignedOperatorId: null
    });
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
    expect(result.intent.status).toBe("review_required");
    expect(transactionClient.transactionIntent.create).toHaveBeenCalled();
    expect(transactionClient.transactionIntent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          manualInterventionReviewCaseId: "review_case_1"
        })
      })
    );
    expect(reviewCasesService.openOrReuseReviewCase).toHaveBeenCalled();
    expect(transactionClient.auditEvent.create).toHaveBeenCalled();
  });

  it("auto-approves low-risk deposit requests when the asset threshold allows it", async () => {
    loadDepositRiskPolicyRuntimeConfigMock.mockReturnValue({
      autoApproveThresholds: [
        {
          assetSymbol: "ETH",
          maxRequestedAmount: "2"
        }
      ]
    });

    const { prismaService, transactionClient, reviewCasesService } = createService();

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

    const service = new TransactionIntentsService(
      prismaService as never,
      {} as never,
      reviewCasesService as never
    );

    const createdIntent = createCustomerIntentRecord({
      status: TransactionIntentStatus.approved,
      policyDecision: PolicyDecision.approved
    });
    transactionClient.transactionIntent.create.mockResolvedValue(createdIntent);

    const result = await service.createDepositIntent("supabase_1", {
      idempotencyKey: "deposit_req_auto_1",
      assetSymbol: "ETH",
      amount: "1.25"
    });

    expect(result.intent.status).toBe("approved");
    expect(result.intent.policyDecision).toBe("approved");
    expect(reviewCasesService.openOrReuseReviewCase).not.toHaveBeenCalled();
    expect(transactionClient.transactionIntent.update).not.toHaveBeenCalled();
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
      createInternalIntentRecord({
        status: TransactionIntentStatus.review_required,
        policyDecision: PolicyDecision.review_required
      })
    ]);

    const result = await service.listPendingDepositIntents({
      limit: 10
    });

    expect(result.limit).toBe(10);
    expect(result.intents).toHaveLength(1);
    expect(result.intents[0].customer.customerId).toBe("customer_1");
    expect(prismaService.transactionIntent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: {
            in: [
              TransactionIntentStatus.requested,
              TransactionIntentStatus.review_required
            ]
          },
          policyDecision: {
            in: [PolicyDecision.pending, PolicyDecision.review_required]
          }
        })
      })
    );
  });

  it("approves a pending deposit intent and writes an audit event", async () => {
    const { service, prismaService, transactionClient } = createService();

    prismaService.transactionIntent.findFirst.mockResolvedValue(
      createInternalIntentRecord({
        status: TransactionIntentStatus.review_required,
        policyDecision: PolicyDecision.review_required,
        manualInterventionReviewCaseId: "review_case_1"
      })
    );
    transactionClient.reviewCase.findUnique.mockResolvedValue({
      id: "review_case_1",
      customerId: "customer_1",
      customerAccountId: "account_1",
      transactionIntentId: "intent_1",
      type: "manual_intervention",
      status: "open",
      assignedOperatorId: null
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

    const result = await service.decideDepositIntent(
      "intent_1",
      "ops_1",
      {
        decision: "approved",
        note: "Looks good."
      },
      "operations_admin"
    );

    expect(result.decision).toBe("approved");
    expect(result.intent.status).toBe(TransactionIntentStatus.approved);
    expect(result.intent.policyDecision).toBe(PolicyDecision.approved);
  });

  it("resumes reviewed deposits at confirmed state when approval follows confirmed proof", async () => {
    const { service, prismaService, transactionClient } = createService();

    prismaService.transactionIntent.findFirst.mockResolvedValue(
      createInternalIntentRecord({
        status: TransactionIntentStatus.review_required,
        policyDecision: PolicyDecision.review_required,
        blockchainStatus: BlockchainTransactionStatus.confirmed,
        txHash:
          "0x1111111111111111111111111111111111111111111111111111111111111111",
        manualInterventionReviewCaseId: "review_case_1"
      })
    );
    transactionClient.reviewCase.findUnique.mockResolvedValue({
      id: "review_case_1",
      customerId: "customer_1",
      customerAccountId: "account_1",
      transactionIntentId: "intent_1",
      type: "manual_intervention",
      status: "open",
      assignedOperatorId: null
    });
    transactionClient.transactionIntent.findFirst.mockResolvedValue(
      createInternalIntentRecord({
        status: TransactionIntentStatus.confirmed,
        policyDecision: PolicyDecision.approved,
        blockchainStatus: BlockchainTransactionStatus.confirmed,
        txHash:
          "0x1111111111111111111111111111111111111111111111111111111111111111"
      })
    );

    const result = await service.decideDepositIntent(
      "intent_1",
      "ops_1",
      {
        decision: "approved",
        note: "Proof validated."
      },
      "operations_admin"
    );

    expect(result.intent.status).toBe(TransactionIntentStatus.confirmed);
    expect(result.intent.policyDecision).toBe(PolicyDecision.approved);
    expect(transactionClient.reviewCase.update).toHaveBeenCalled();
    expect(transactionClient.reviewCaseEvent.create).toHaveBeenCalled();
  });

  it("denies a pending deposit intent and writes an audit event", async () => {
    const { service, prismaService, transactionClient } = createService();

    prismaService.transactionIntent.findFirst.mockResolvedValue(
      createInternalIntentRecord({
        status: TransactionIntentStatus.review_required,
        policyDecision: PolicyDecision.review_required,
        manualInterventionReviewCaseId: "review_case_1"
      })
    );
    transactionClient.reviewCase.findUnique.mockResolvedValue({
      id: "review_case_1",
      customerId: "customer_1",
      customerAccountId: "account_1",
      transactionIntentId: "intent_1",
      type: "manual_intervention",
      status: "open",
      assignedOperatorId: null
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

    const result = await service.decideDepositIntent(
      "intent_1",
      "ops_1",
      {
        decision: "denied",
        denialReason: "Proof of funds missing."
      },
      "risk_manager"
    );

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
      { note: "Send to worker." },
      "operations_admin"
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
      {},
      "operations_admin"
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

  it("rejects deposit broadcast records that target the wrong wallet", async () => {
    const { service, prismaService } = createService();

    prismaService.transactionIntent.findFirst.mockResolvedValue(
      createInternalIntentRecord({
        status: TransactionIntentStatus.queued,
        policyDecision: PolicyDecision.approved
      })
    );

    await expect(
      service.recordDepositBroadcast("intent_1", "worker_1", {
        txHash:
          "0x1111111111111111111111111111111111111111111111111111111111111111",
        fromAddress: "0x0000000000000000000000000000000000000def",
        toAddress: "0x0000000000000000000000000000000000000fed"
      })
    ).rejects.toThrow(
      "Deposit broadcast destination must match the managed deposit wallet."
    );
  });

  it("records a deposit broadcast from the operator custody surface", async () => {
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

    const result = await service.recordDepositBroadcastByOperator(
      "intent_1",
      "ops_1",
      {
        txHash:
          "0x1111111111111111111111111111111111111111111111111111111111111111",
        fromAddress: "0x0000000000000000000000000000000000000def",
        toAddress: "0x0000000000000000000000000000000000000abc"
      },
      "operations_admin"
    );

    expect(transactionClient.auditEvent.create).toHaveBeenCalledWith(
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
    expect(result.broadcastReused).toBe(false);
    expect(result.intent.status).toBe(TransactionIntentStatus.broadcast);
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

  it("reuses an identical deposit execution failure instead of conflicting", async () => {
    const { service, prismaService } = createService();

    prismaService.transactionIntent.findFirst.mockResolvedValue(
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

    expect(result.failureReused).toBe(true);
    expect(result.intent.status).toBe(TransactionIntentStatus.failed);
    expect(prismaService.$transaction).not.toHaveBeenCalled();
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
      }, "operations_admin")
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects deposit decisions from an unauthorized operator role", async () => {
    const { service } = createService();

    await expect(
      service.decideDepositIntent(
        "intent_1",
        "ops_1",
        {
          decision: "approved"
        },
        "junior_operator"
      )
    ).rejects.toThrow(
      "Operator role is not authorized to approve or deny transaction intents."
    );
  });

  it("fails when the authenticated user does not have a customer account projection", async () => {
    const { service, prismaService } = createService();

    prismaService.customerAccount.findFirst.mockResolvedValue(null);

    await expect(
      service.listMyTransactionIntents("missing_user", {})
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("moves a broadcast deposit under review when source proof is missing at confirmation time", async () => {
    const { service, prismaService, transactionClient, reviewCasesService } =
      createService();

    prismaService.transactionIntent.findFirst.mockResolvedValue(
      createInternalIntentRecord({
        status: TransactionIntentStatus.broadcast,
        policyDecision: PolicyDecision.approved,
        blockchainStatus: BlockchainTransactionStatus.broadcast,
        txHash:
          "0x1111111111111111111111111111111111111111111111111111111111111111",
        fromAddress: null
      })
    );
    reviewCasesService.openOrReuseReviewCase.mockResolvedValue({
      reviewCase: {
        id: "review_case_2"
      },
      reviewCaseReused: false
    });
    transactionClient.transactionIntent.findFirst
      .mockResolvedValueOnce(
        createInternalIntentRecord({
          status: TransactionIntentStatus.broadcast,
          policyDecision: PolicyDecision.approved,
          blockchainStatus: BlockchainTransactionStatus.broadcast,
          txHash:
            "0x1111111111111111111111111111111111111111111111111111111111111111",
          fromAddress: null
        })
      )
      .mockResolvedValueOnce(
        createInternalIntentRecord({
          status: TransactionIntentStatus.review_required,
          policyDecision: PolicyDecision.review_required,
          blockchainStatus: BlockchainTransactionStatus.broadcast,
          txHash:
            "0x1111111111111111111111111111111111111111111111111111111111111111",
          fromAddress: null,
          manualInterventionReviewCaseId: "review_case_2",
          failureCode: "deposit_proof:missing_source_address",
          failureReason:
            "The latest blockchain transaction is missing a source address."
        })
      );

    const result = await service.confirmDepositIntent("intent_1", "worker_1", {
      txHash:
        "0x1111111111111111111111111111111111111111111111111111111111111111"
    });

    expect(result.confirmReused).toBe(false);
    expect(result.intent.status).toBe(TransactionIntentStatus.review_required);
    expect(result.intent.policyDecision).toBe(PolicyDecision.review_required);
    expect(reviewCasesService.openOrReuseReviewCase).toHaveBeenCalled();
  });

  it("excludes invalid confirmed deposits from the settlement-ready list", async () => {
    const { service, prismaService } = createService();

    prismaService.transactionIntent.findMany.mockResolvedValue([
      createInternalIntentRecord({
        status: TransactionIntentStatus.confirmed,
        policyDecision: PolicyDecision.approved,
        blockchainStatus: BlockchainTransactionStatus.confirmed,
        txHash:
          "0x1111111111111111111111111111111111111111111111111111111111111111",
        toAddress: "0x0000000000000000000000000000000000000fed"
      })
    ]);

    const result = await service.listConfirmedDepositIntentsReadyToSettle({
      limit: 5
    });

    expect(result.intents).toHaveLength(0);
  });

  it("creates an immutable settlement proof when settling a confirmed deposit", async () => {
    const { service, prismaService, transactionClient } = createService();

    prismaService.transactionIntent.findFirst.mockResolvedValue(
      createInternalIntentRecord({
        status: TransactionIntentStatus.confirmed,
        policyDecision: PolicyDecision.approved,
        blockchainStatus: BlockchainTransactionStatus.confirmed,
        txHash:
          "0x1111111111111111111111111111111111111111111111111111111111111111"
      })
    );
    prismaService.ledgerJournal.findUnique.mockResolvedValue(null);
    transactionClient.ledgerJournal.findUnique.mockResolvedValue(null);
    transactionClient.depositSettlementProof.findUnique.mockResolvedValue(null);
    transactionClient.transactionIntent.findFirst
      .mockResolvedValueOnce(
        createInternalIntentRecord({
          status: TransactionIntentStatus.confirmed,
          policyDecision: PolicyDecision.approved,
          blockchainStatus: BlockchainTransactionStatus.confirmed,
          txHash:
            "0x1111111111111111111111111111111111111111111111111111111111111111"
        })
      )
      .mockResolvedValueOnce(
        createInternalIntentRecord({
          status: TransactionIntentStatus.settled,
          policyDecision: PolicyDecision.approved,
          blockchainStatus: BlockchainTransactionStatus.confirmed,
          txHash:
            "0x1111111111111111111111111111111111111111111111111111111111111111"
        })
      );
    transactionClient.depositSettlementProof.create.mockResolvedValue({
      id: "deposit_settlement_proof_1"
    });
    transactionClient.auditEvent.create.mockResolvedValue({
      id: "audit_settle_1"
    });

    const ledgerService = {
      settleConfirmedDeposit: jest.fn().mockResolvedValue({
        ledgerJournalId: "journal_1",
        debitLedgerAccountId: "ledger_account_1",
        creditLedgerAccountId: "ledger_account_2",
        availableBalance: "1.25"
      })
    };

    const proofAwareService = new TransactionIntentsService(
      prismaService as never,
      ledgerService as never,
      { openOrReuseReviewCase: jest.fn() } as never
    );

    const result = await proofAwareService.settleConfirmedDepositIntent(
      "intent_1",
      "worker_1",
      {
        note: "Settled after final confirmation."
      }
    );

    expect(result.intent.status).toBe(TransactionIntentStatus.settled);
    expect(transactionClient.depositSettlementProof.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          transactionIntentId: "intent_1",
          ledgerJournalId: "journal_1",
          txHash:
            "0x1111111111111111111111111111111111111111111111111111111111111111"
        })
      })
    );
  });

  it("moves a confirmed deposit under review instead of settling when proof is mismatched", async () => {
    const { service, prismaService, transactionClient, reviewCasesService } =
      createService();

    prismaService.transactionIntent.findFirst.mockResolvedValue(
      createInternalIntentRecord({
        status: TransactionIntentStatus.confirmed,
        policyDecision: PolicyDecision.approved,
        blockchainStatus: BlockchainTransactionStatus.confirmed,
        txHash:
          "0x1111111111111111111111111111111111111111111111111111111111111111",
        toAddress: "0x0000000000000000000000000000000000000fed"
      })
    );
    prismaService.ledgerJournal.findUnique.mockResolvedValue(null);
    transactionClient.ledgerJournal.findUnique.mockResolvedValue(null);
    reviewCasesService.openOrReuseReviewCase.mockResolvedValue({
      reviewCase: {
        id: "review_case_3"
      },
      reviewCaseReused: false
    });
    transactionClient.transactionIntent.findFirst
      .mockResolvedValueOnce(
        createInternalIntentRecord({
          status: TransactionIntentStatus.confirmed,
          policyDecision: PolicyDecision.approved,
          blockchainStatus: BlockchainTransactionStatus.confirmed,
          txHash:
            "0x1111111111111111111111111111111111111111111111111111111111111111",
          toAddress: "0x0000000000000000000000000000000000000fed"
        })
      )
      .mockResolvedValueOnce(
        createInternalIntentRecord({
          status: TransactionIntentStatus.review_required,
          policyDecision: PolicyDecision.review_required,
          blockchainStatus: BlockchainTransactionStatus.confirmed,
          txHash:
            "0x1111111111111111111111111111111111111111111111111111111111111111",
          toAddress: "0x0000000000000000000000000000000000000fed",
          manualInterventionReviewCaseId: "review_case_3",
          failureCode: "deposit_proof:destination_wallet_mismatch",
          failureReason:
            "The latest blockchain transaction destination does not match the managed deposit wallet."
        })
      );

    const result = await service.settleConfirmedDepositIntent(
      "intent_1",
      "worker_1",
      {
        note: "Investigate proof mismatch."
      }
    );

    expect(result.settlementReused).toBe(false);
    expect(result.intent.status).toBe(TransactionIntentStatus.review_required);
    expect(result.intent.policyDecision).toBe(PolicyDecision.review_required);
    expect(reviewCasesService.openOrReuseReviewCase).toHaveBeenCalled();
  });
});
