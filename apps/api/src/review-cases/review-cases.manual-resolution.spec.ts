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
    type: ReviewCaseType.withdrawal_review,
    status: ReviewCaseStatus.open,
    reasonCode: "policy_denied",
    notes: "Customer support follow-up required.",
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
      intentType: TransactionIntentType.withdrawal,
      status: TransactionIntentStatus.failed,
      policyDecision: PolicyDecision.denied,
      requestedAmount: new Prisma.Decimal("30"),
      settledAmount: null,
      failureCode: "policy_denied",
      failureReason: "Manual review rejected.",
      manuallyResolvedAt: null,
      manualResolutionReasonCode: null,
      manualResolutionNote: null,
      sourceWalletId: "wallet_1",
      destinationWalletId: null,
      externalAddress: "0x0000000000000000000000000000000000000abc",
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
      updatedAt: new Date("2026-04-01T00:10:00.000Z"),
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
      destinationWallet: null,
      blockchainTransactions: [
        {
          id: "tx_1",
          txHash:
            "0x1111111111111111111111111111111111111111111111111111111111111111",
          status: BlockchainTransactionStatus.failed,
          fromAddress: "0x0000000000000000000000000000000000000def",
          toAddress: "0x0000000000000000000000000000000000000abc",
          createdAt: new Date("2026-04-01T00:01:00.000Z"),
          updatedAt: new Date("2026-04-01T00:05:00.000Z"),
          confirmedAt: null
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
      findMany: jest.fn(),
      update: jest.fn()
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

describe("ReviewCasesService manual resolution", () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("returns manual resolution eligibility for a failed linked intent", async () => {
    const { service } = createService();

    jest.spyOn(service as any, "findReviewCaseById").mockResolvedValue(
      buildReviewCaseRecord()
    );

    const result = await service.getManualResolutionEligibility("review_case_1");

    expect(result.eligible).toBe(true);
    expect(result.reasonCode).toBe(
      "terminal_intent_safe_for_manual_resolution"
    );
  });

  it("applies manual resolution and resolves the review case", async () => {
    const { service, prismaService } = createService();

    const existingReviewCase = buildReviewCaseRecord();

    jest
      .spyOn(service as any, "findReviewCaseById")
      .mockResolvedValue(existingReviewCase);

    const updatedIntent = {
      ...existingReviewCase.transactionIntent,
      status: TransactionIntentStatus.manually_resolved,
      manuallyResolvedAt: new Date("2026-04-01T00:30:00.000Z"),
      manualResolutionReasonCode: "support_case_closed",
      manualResolutionNote: "Handled off-platform."
    };

    const updatedReviewCase = {
      ...existingReviewCase,
      status: ReviewCaseStatus.resolved,
      assignedOperatorId: "ops_1",
      startedAt: new Date("2026-04-01T00:20:00.000Z"),
      resolvedAt: new Date("2026-04-01T00:30:00.000Z"),
      transactionIntent: updatedIntent
    };

    const transaction = {
      transactionIntent: {
        update: jest.fn().mockResolvedValue(updatedIntent)
      },
      reviewCase: {
        update: jest.fn().mockResolvedValue(updatedReviewCase)
      },
      reviewCaseEvent: {
        create: jest
          .fn()
          .mockResolvedValueOnce({
            id: "event_1",
            reviewCaseId: "review_case_1",
            actorType: "operator",
            actorId: "ops_1",
            eventType: ReviewCaseEventType.manual_resolution_applied,
            note: "Handled off-platform.",
            metadata: null,
            createdAt: new Date("2026-04-01T00:30:00.000Z")
          })
          .mockResolvedValueOnce({
            id: "event_2",
            reviewCaseId: "review_case_1",
            actorType: "operator",
            actorId: "ops_1",
            eventType: ReviewCaseEventType.resolved,
            note: "Handled off-platform.",
            metadata: null,
            createdAt: new Date("2026-04-01T00:30:00.000Z")
          })
      },
      auditEvent: {
        create: jest.fn().mockResolvedValue(undefined)
      }
    };

    (prismaService.$transaction as jest.Mock).mockImplementation(
      async (callback: (tx: any) => Promise<unknown>) => callback(transaction)
    );

    const result = await service.applyManualResolution("review_case_1", "ops_1", {
      manualResolutionReasonCode: "support_case_closed",
      note: "Handled off-platform."
    });

    expect(result.stateReused).toBe(false);
    expect(result.transactionIntent.status).toBe(
      TransactionIntentStatus.manually_resolved
    );
    expect(result.reviewCase.status).toBe(ReviewCaseStatus.resolved);
  });

  it("rejects manual resolution for a settled linked intent", async () => {
    const { service } = createService();

    jest.spyOn(service as any, "findReviewCaseById").mockResolvedValue(
      buildReviewCaseRecord({
        type: ReviewCaseType.reconciliation_review,
        transactionIntent: {
          ...buildReviewCaseRecord().transactionIntent,
          status: TransactionIntentStatus.settled,
          policyDecision: PolicyDecision.approved,
          settledAmount: new Prisma.Decimal("30")
        }
      })
    );

    await expect(
      service.applyManualResolution("review_case_1", "ops_1", {
        manualResolutionReasonCode: "operator_override_not_needed"
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects manual resolution when the case is assigned to another operator", async () => {
    const { service } = createService();

    jest.spyOn(service as any, "findReviewCaseById").mockResolvedValue(
      buildReviewCaseRecord({
        status: ReviewCaseStatus.in_progress,
        assignedOperatorId: "ops_2"
      })
    );

    await expect(
      service.applyManualResolution("review_case_1", "ops_1", {
        manualResolutionReasonCode: "support_case_closed"
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects eligibility lookup when the review case does not exist", async () => {
    const { service } = createService();

    jest.spyOn(service as any, "findReviewCaseById").mockResolvedValue(null);

    await expect(
      service.getManualResolutionEligibility("missing_case")
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
