import {
  ConflictException,
  NotFoundException
} from "@nestjs/common";
import {
  BlockchainTransactionStatus,
  PolicyDecision,
  Prisma,
  ReviewCaseEventType,
  ReviewCaseStatus,
  ReviewCaseType,
  TransactionIntentStatus,
  TransactionIntentType
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ReviewCasesService } from "./review-cases.service";

function buildReviewCaseRecord(
  overrides: Partial<Record<string, unknown>> = {}
) {
  return {
    id: "review_case_1",
    customerId: "customer_1",
    customerAccountId: "account_1",
    transactionIntentId: "intent_1",
    type: ReviewCaseType.reconciliation_review,
    status: ReviewCaseStatus.open,
    reasonCode: "settled_amount_mismatch",
    notes: "Manual review is required.",
    assignedOperatorId: null,
    startedAt: null,
    resolvedAt: null,
    dismissedAt: null,
    createdAt: new Date("2026-04-01T00:00:00.000Z"),
    updatedAt: new Date("2026-04-01T00:00:00.000Z"),
    customer: {
      id: "customer_1",
      supabaseUserId: "supabase_1",
      email: "user@example.com",
      firstName: "Waqas",
      lastName: "Raza"
    },
    customerAccount: {
      id: "account_1",
      customerId: "customer_1"
    },
    transactionIntent: {
      id: "intent_1",
      intentType: TransactionIntentType.deposit,
      status: TransactionIntentStatus.settled,
      policyDecision: PolicyDecision.approved,
      requestedAmount: new Prisma.Decimal("25"),
      settledAmount: new Prisma.Decimal("20"),
      failureCode: null,
      failureReason: null,
      manuallyResolvedAt: null,
      manualResolutionReasonCode: null,
      manualResolutionNote: null,
      sourceWalletId: null,
      destinationWalletId: "wallet_1",
      externalAddress: null,
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
      updatedAt: new Date("2026-04-01T00:10:00.000Z"),
      asset: {
        id: "asset_1",
        symbol: "USDC",
        displayName: "USD Coin",
        decimals: 6,
        chainId: 8453
      },
      sourceWallet: null,
      destinationWallet: {
        id: "wallet_1",
        address: "0x0000000000000000000000000000000000000fed"
      },
      blockchainTransactions: [
        {
          id: "tx_1",
          txHash:
            "0x1111111111111111111111111111111111111111111111111111111111111111",
          status: BlockchainTransactionStatus.confirmed,
          fromAddress: "0x0000000000000000000000000000000000000def",
          toAddress: "0x0000000000000000000000000000000000000fed",
          createdAt: new Date("2026-04-01T00:01:00.000Z"),
          updatedAt: new Date("2026-04-01T00:05:00.000Z"),
          confirmedAt: new Date("2026-04-01T00:05:00.000Z")
        }
      ]
    },
    ...overrides
  };
}

function createService() {
  const prismaService = {
    reviewCase: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    },
    reviewCaseEvent: {
      findMany: jest.fn(),
      create: jest.fn()
    },
    transactionIntent: {
      findFirst: jest.fn(),
      findMany: jest.fn()
    },
    auditEvent: {
      create: jest.fn(),
      findMany: jest.fn()
    },
    customerAssetBalance: {
      findMany: jest.fn()
    },
    $transaction: jest.fn()
  } as unknown as PrismaService;

  const service = new ReviewCasesService(prismaService);

  return {
    service,
    prismaService
  };
}

describe("ReviewCasesService", () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("opens a new review case when no active matching case exists", async () => {
    const { service, prismaService } = createService();

    const mutationClient = {
      reviewCase: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(buildReviewCaseRecord())
      },
      reviewCaseEvent: {
        create: jest.fn().mockResolvedValue({
          id: "event_1",
          reviewCaseId: "review_case_1",
          actorType: "operator",
          actorId: "ops_1",
          eventType: ReviewCaseEventType.opened,
          note: "Manual review is required.",
          metadata: null,
          createdAt: new Date("2026-04-01T00:00:00.000Z")
        })
      },
      auditEvent: {
        create: jest.fn().mockResolvedValue(undefined)
      }
    } as any;

    const result = await service.openOrReuseReviewCase(mutationClient, {
      customerId: "customer_1",
      customerAccountId: "account_1",
      transactionIntentId: "intent_1",
      type: ReviewCaseType.reconciliation_review,
      reasonCode: "settled_amount_mismatch",
      notes: "Manual review is required.",
      actorType: "operator",
      actorId: "ops_1",
      auditAction: "review_case.reconciliation_review.opened",
      auditMetadata: {
        intentType: "deposit"
      }
    });

    expect(result.reviewCaseReused).toBe(false);
    expect(result.reviewCase.type).toBe(ReviewCaseType.reconciliation_review);
    expect(mutationClient.reviewCaseEvent.create).toHaveBeenCalled();
    expect(prismaService).toBeDefined();
  });

  it("reuses an existing open review case", async () => {
    const { service } = createService();

    const mutationClient = {
      reviewCase: {
        findFirst: jest.fn().mockResolvedValue(buildReviewCaseRecord())
      },
      reviewCaseEvent: {
        create: jest.fn()
      },
      auditEvent: {
        create: jest.fn()
      }
    } as any;

    const result = await service.openOrReuseReviewCase(mutationClient, {
      customerId: "customer_1",
      customerAccountId: "account_1",
      transactionIntentId: "intent_1",
      type: ReviewCaseType.reconciliation_review,
      reasonCode: "settled_amount_mismatch",
      notes: "Manual review is required.",
      actorType: "operator",
      actorId: "ops_1",
      auditAction: "review_case.reconciliation_review.opened",
      auditMetadata: {
        intentType: "deposit"
      }
    });

    expect(result.reviewCaseReused).toBe(true);
  });

  it("opens or reuses a denied withdrawal review case only for denied withdrawals", async () => {
    const { service, prismaService } = createService();

    (prismaService.transactionIntent.findFirst as jest.Mock).mockResolvedValue({
      id: "intent_2",
      intentType: TransactionIntentType.withdrawal,
      status: TransactionIntentStatus.failed,
      policyDecision: PolicyDecision.denied,
      requestedAmount: new Prisma.Decimal("30"),
      failureCode: "policy_denied",
      failureReason: "Manual review rejected.",
      chainId: 8453,
      asset: {
        id: "asset_1",
        symbol: "USDC",
        displayName: "USD Coin",
        decimals: 6,
        chainId: 8453
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
      }
    });

    const openOrReuseSpy = jest
      .spyOn(service, "openOrReuseReviewCase")
      .mockResolvedValue({
        reviewCase: {
          ...buildReviewCaseRecord({
            id: "review_case_2",
            type: ReviewCaseType.withdrawal_review,
            transactionIntent: {
              ...buildReviewCaseRecord().transactionIntent,
              id: "intent_2",
              intentType: TransactionIntentType.withdrawal,
              status: TransactionIntentStatus.failed,
              policyDecision: PolicyDecision.denied,
              requestedAmount: new Prisma.Decimal("30"),
              settledAmount: null,
              failureCode: "policy_denied",
              failureReason: "Manual review rejected.",
              sourceWalletId: "wallet_1",
              destinationWalletId: null,
              externalAddress: "0x0000000000000000000000000000000000000abc",
              asset: {
                id: "asset_1",
                symbol: "USDC",
                displayName: "USD Coin",
                decimals: 6,
                chainId: 8453
              }
            }
          })
        } as any,
        reviewCaseReused: false
      });

    const result = await service.openDeniedWithdrawalReviewCase("intent_2", "ops_1", {
      note: "Need support follow-up."
    });

    expect(result.reviewCaseReused).toBe(false);
    expect(openOrReuseSpy).toHaveBeenCalled();
  });

  it("resolves an open review case", async () => {
    const { service, prismaService } = createService();

    jest
      .spyOn(service as any, "findReviewCaseById")
      .mockResolvedValue(buildReviewCaseRecord());

    const updatedRecord = buildReviewCaseRecord({
      status: ReviewCaseStatus.resolved,
      resolvedAt: new Date("2026-04-01T00:40:00.000Z"),
      notes: "Resolved by operator."
    });

    const transaction = {
      reviewCase: {
        update: jest.fn().mockResolvedValue(updatedRecord)
      },
      reviewCaseEvent: {
        create: jest.fn().mockResolvedValue({
          id: "event_4",
          reviewCaseId: "review_case_1",
          actorType: "operator",
          actorId: "ops_1",
          eventType: ReviewCaseEventType.resolved,
          note: "Resolved by operator.",
          metadata: null,
          createdAt: new Date("2026-04-01T00:40:00.000Z")
        })
      },
      auditEvent: {
        create: jest.fn().mockResolvedValue(undefined)
      }
    };

    (prismaService.$transaction as jest.Mock).mockImplementation(
      async (callback: (transactionClient: any) => Promise<unknown>) =>
        callback(transaction)
    );

    const result = await service.resolveReviewCase("review_case_1", "ops_1", {
      note: "Resolved by operator."
    });

    expect(result.stateReused).toBe(false);
    expect(result.reviewCase.status).toBe(ReviewCaseStatus.resolved);
  });

  it("rejects dismiss when the review case is already resolved", async () => {
    const { service } = createService();

    jest.spyOn(service as any, "findReviewCaseById").mockResolvedValue(
      buildReviewCaseRecord({
        status: ReviewCaseStatus.resolved
      })
    );

    await expect(
      service.dismissReviewCase("review_case_1", "ops_1", {})
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects get when the review case does not exist", async () => {
    const { service } = createService();

    jest.spyOn(service as any, "findReviewCaseById").mockResolvedValue(null);

    await expect(service.getReviewCase("missing_case")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });
});
