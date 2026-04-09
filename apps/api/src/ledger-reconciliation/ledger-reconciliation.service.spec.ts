jest.mock("@stealth-trails-bank/config/api", () => ({
  loadProductChainRuntimeConfig: () => ({
    productChainId: 8453
  })
}));

import {
  LedgerReconciliationMismatchRecommendedAction,
  LedgerReconciliationMismatchScope,
  LedgerReconciliationMismatchSeverity,
  LedgerReconciliationMismatchStatus,
  PolicyDecision,
  Prisma,
  ReviewCaseStatus,
  ReviewCaseType,
  TransactionIntentStatus,
  TransactionIntentType
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ReviewCasesService } from "../review-cases/review-cases.service";
import { TransactionIntentsService } from "../transaction-intents/transaction-intents.service";
import { WithdrawalIntentsService } from "../transaction-intents/withdrawal-intents.service";
import { LedgerReconciliationService } from "./ledger-reconciliation.service";

function buildMismatchRecord(
  overrides: Partial<Record<string, unknown>> = {}
) {
  return {
    id: "mismatch_1",
    mismatchKey: "customer_balance:account_1:asset_1",
    scope: LedgerReconciliationMismatchScope.customer_balance,
    status: LedgerReconciliationMismatchStatus.open,
    severity: LedgerReconciliationMismatchSeverity.critical,
    recommendedAction:
      LedgerReconciliationMismatchRecommendedAction.open_review_case,
    reasonCode: "customer_asset_balance_projection_unrepairable",
    summary: "Projection cannot be repaired safely.",
    chainId: 8453,
    customerId: "customer_1",
    customerAccountId: "account_1",
    transactionIntentId: null,
    assetId: "asset_1",
    linkedReviewCaseId: null,
    latestSnapshot: {
      scope: "customer_balance"
    },
    resolutionMetadata: null,
    resolutionNote: null,
    detectionCount: 2,
    firstDetectedAt: new Date("2026-04-06T00:00:00.000Z"),
    lastDetectedAt: new Date("2026-04-06T00:05:00.000Z"),
    resolvedAt: null,
    resolvedByOperatorId: null,
    dismissedAt: null,
    dismissedByOperatorId: null,
    createdAt: new Date("2026-04-06T00:00:00.000Z"),
    updatedAt: new Date("2026-04-06T00:05:00.000Z"),
    customer: {
      id: "customer_1",
      email: "user@example.com",
      supabaseUserId: "supabase_1",
      firstName: "Waqas",
      lastName: "Raza"
    },
    customerAccount: {
      id: "account_1",
      status: "active"
    },
    asset: {
      id: "asset_1",
      symbol: "USDC",
      displayName: "USD Coin",
      decimals: 6,
      chainId: 8453
    },
    transactionIntent: null,
    linkedReviewCase: null,
    ...overrides
  };
}

function createService() {
  const prismaService = {
    ledgerReconciliationMismatch: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    },
    ledgerReconciliationScanRun: {
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn()
    },
    customerAssetBalance: {
      findMany: jest.fn()
    },
    ledgerAccount: {
      findMany: jest.fn()
    },
    transactionIntent: {
      findMany: jest.fn()
    },
    auditEvent: {
      create: jest.fn(),
      findMany: jest.fn()
    },
    reviewCase: {
      update: jest.fn()
    },
    reviewCaseEvent: {
      create: jest.fn()
    },
    $transaction: jest.fn()
  } as unknown as PrismaService;

  const transactionIntentsService = {} as TransactionIntentsService;
  const withdrawalIntentsService = {} as WithdrawalIntentsService;
  const reviewCasesService = {
    openOrReuseReviewCase: jest.fn()
  } as unknown as ReviewCasesService;

  return {
    prismaService,
    transactionIntentsService,
    withdrawalIntentsService,
    reviewCasesService,
    service: new LedgerReconciliationService(
      prismaService,
      transactionIntentsService,
      withdrawalIntentsService,
      reviewCasesService
    )
  };
}

describe("LedgerReconciliationService", () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("preserves an active linked review case when rescanning an open balance mismatch", async () => {
    const { service, prismaService } = createService();

    jest
      .spyOn(service as any, "buildTransactionIntentCandidates")
      .mockResolvedValue([]);
    jest.spyOn(service as any, "buildBalanceCandidates").mockResolvedValue([
      {
        mismatchKey: "customer_balance:account_1:asset_1",
        scope: LedgerReconciliationMismatchScope.customer_balance,
        severity: LedgerReconciliationMismatchSeverity.critical,
        recommendedAction:
          LedgerReconciliationMismatchRecommendedAction.open_review_case,
        reasonCode: "customer_asset_balance_projection_unrepairable",
        summary: "Projection cannot be repaired safely.",
        chainId: 8453,
        customerId: "customer_1",
        customerAccountId: "account_1",
        transactionIntentId: null,
        assetId: "asset_1",
        linkedReviewCaseId: null,
        latestSnapshot: {
          scope: "customer_balance"
        }
      }
    ]);

    const existingMismatch = buildMismatchRecord({
      linkedReviewCaseId: "review_case_1",
      linkedReviewCase: {
        id: "review_case_1",
        type: ReviewCaseType.reconciliation_review,
        status: ReviewCaseStatus.in_progress,
        assignedOperatorId: "ops_2",
        updatedAt: new Date("2026-04-06T00:06:00.000Z")
      }
    });

    const updatedMismatch = buildMismatchRecord({
      linkedReviewCaseId: "review_case_1",
      recommendedAction: LedgerReconciliationMismatchRecommendedAction.none,
      linkedReviewCase: existingMismatch.linkedReviewCase,
      updatedAt: new Date("2026-04-06T00:07:00.000Z")
    });

    (prismaService.ledgerReconciliationMismatch.findMany as jest.Mock)
      .mockResolvedValueOnce([existingMismatch])
      .mockResolvedValueOnce([updatedMismatch]);
    (prismaService.ledgerReconciliationMismatch.update as jest.Mock).mockResolvedValue(
      updatedMismatch
    );
    (prismaService.auditEvent.create as jest.Mock).mockResolvedValue(undefined);

    const result = await service.scanMismatches(
      {
        scope: "customer_balance",
        customerAccountId: "account_1"
      },
      {
        actorType: "operator",
        actorId: "ops_1"
      }
    );

    expect(prismaService.ledgerReconciliationMismatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          linkedReviewCaseId: "review_case_1",
          recommendedAction: LedgerReconciliationMismatchRecommendedAction.none
        })
      })
    );
    expect(result.activeMismatchCount).toBe(1);
    expect(result.mismatches[0]?.linkedReviewCase?.reviewCaseId).toBe(
      "review_case_1"
    );
    expect(result.mismatches[0]?.recommendedAction).toBe("none");
  });

  it("opens a reconciliation review case for a customer balance mismatch", async () => {
    const { service, prismaService, reviewCasesService } = createService();

    const mismatch = buildMismatchRecord();
    const linkedMismatch = buildMismatchRecord({
      linkedReviewCaseId: "review_case_2",
      recommendedAction: LedgerReconciliationMismatchRecommendedAction.none,
      linkedReviewCase: {
        id: "review_case_2",
        type: ReviewCaseType.reconciliation_review,
        status: ReviewCaseStatus.open,
        assignedOperatorId: null,
        updatedAt: new Date("2026-04-06T00:08:00.000Z")
      }
    });

    jest.spyOn(service as any, "findMismatchById").mockResolvedValue(mismatch);
    (reviewCasesService.openOrReuseReviewCase as jest.Mock).mockResolvedValue({
      reviewCase: {
        id: "review_case_2"
      },
      reviewCaseReused: false
    });
    (prismaService.ledgerReconciliationMismatch.update as jest.Mock).mockResolvedValue(
      linkedMismatch
    );
    (prismaService.auditEvent.create as jest.Mock).mockResolvedValue(undefined);

    const result = await service.openReviewCaseForMismatch(
      "mismatch_1",
      "ops_1",
      "Manual review required."
    );

    expect(reviewCasesService.openOrReuseReviewCase).toHaveBeenCalledWith(
      prismaService,
      expect.objectContaining({
        customerAccountId: "account_1",
        transactionIntentId: null,
        reasonCode: "customer_asset_balance_projection_unrepairable",
        type: ReviewCaseType.reconciliation_review
      })
    );
    expect(result.mismatch.linkedReviewCase?.reviewCaseId).toBe("review_case_2");
  });

  it("repairs a customer balance mismatch and verifies that the scan resolves it", async () => {
    const { service, prismaService } = createService();

    const mismatch = buildMismatchRecord({
      recommendedAction:
        LedgerReconciliationMismatchRecommendedAction.repair_customer_balance,
      reasonCode: "customer_asset_balance_projection_mismatch",
      summary: "Projection diverges from ledger state."
    });

    const currentCandidate = {
      mismatchKey: "customer_balance:account_1:asset_1",
      scope: LedgerReconciliationMismatchScope.customer_balance,
      severity: LedgerReconciliationMismatchSeverity.critical,
      recommendedAction:
        LedgerReconciliationMismatchRecommendedAction.repair_customer_balance,
      reasonCode: "customer_asset_balance_projection_mismatch",
      summary: "Projection diverges from ledger state.",
      chainId: 8453,
      customerId: "customer_1",
      customerAccountId: "account_1",
      transactionIntentId: null,
      assetId: "asset_1",
      linkedReviewCaseId: null,
      latestSnapshot: {
        actualBalance: {
          exists: true,
          availableBalance: "4",
          pendingBalance: "1"
        },
        expectedBalance: {
          availableBalance: "8",
          pendingBalance: "2"
        }
      } satisfies Prisma.JsonObject
    };

    const resolvedMismatch = buildMismatchRecord({
      status: LedgerReconciliationMismatchStatus.resolved,
      recommendedAction: LedgerReconciliationMismatchRecommendedAction.none,
      reasonCode: "customer_asset_balance_projection_mismatch",
      summary: "Projection diverges from ledger state.",
      resolvedAt: new Date("2026-04-06T00:09:00.000Z"),
      updatedAt: new Date("2026-04-06T00:09:00.000Z")
    });

    jest.spyOn(service as any, "findMismatchById").mockResolvedValue(mismatch);
    jest
      .spyOn(service as any, "buildBalanceCandidates")
      .mockResolvedValue([currentCandidate]);
    jest
      .spyOn(service as any, "refreshMismatchAfterTargetedScan")
      .mockResolvedValue(resolvedMismatch);

    const transaction = {
      customerAssetBalance: {
        upsert: jest.fn().mockResolvedValue(undefined)
      },
      auditEvent: {
        create: jest.fn().mockResolvedValue(undefined)
      }
    };

    (prismaService.$transaction as jest.Mock).mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction)
    );
    (prismaService.ledgerReconciliationMismatch.update as jest.Mock).mockResolvedValue(
      buildMismatchRecord({
        ...resolvedMismatch,
        resolutionMetadata: {
          repairAction: "repair_customer_balance"
        },
        resolutionNote: "Customer balance projection rebuilt from ledger.",
        resolvedByOperatorId: "ops_1"
      })
    );

    const result = await service.repairCustomerBalanceMismatch(
      "mismatch_1",
      "ops_1",
      "Rebuilt from ledger."
    );

    expect(transaction.customerAssetBalance.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: {
          availableBalance: new Prisma.Decimal("8"),
          pendingBalance: new Prisma.Decimal("2")
        }
      })
    );
    expect((service as any).refreshMismatchAfterTargetedScan).toHaveBeenCalledWith(
      {
        scope: "customer_balance",
        customerAccountId: "account_1"
      },
      "customer_balance:account_1:asset_1",
      "ops_1"
    );
    expect(result.mismatch.status).toBe("resolved");
    expect(result.mismatch.resolvedByOperatorId).toBe("ops_1");
  });

  it("tracks operator-triggered scan runs and persists the scan summary", async () => {
    const { service, prismaService } = createService();

    (prismaService.ledgerReconciliationScanRun.create as jest.Mock).mockResolvedValue({
      id: "scan_run_1",
      triggerSource: "operator",
      status: "running",
      requestedScope: "customer_balance",
      customerAccountId: "account_1",
      transactionIntentId: null,
      triggeredByOperatorId: "ops_1",
      triggeredByWorkerId: null,
      startedAt: new Date("2026-04-06T10:00:00.000Z"),
      completedAt: null,
      durationMs: null,
      createdCount: 0,
      reopenedCount: 0,
      refreshedCount: 0,
      autoResolvedCount: 0,
      activeMismatchCount: 0,
      errorCode: null,
      errorMessage: null,
      resultSnapshot: null,
      createdAt: new Date("2026-04-06T10:00:00.000Z"),
      updatedAt: new Date("2026-04-06T10:00:00.000Z")
    });
    (prismaService.ledgerReconciliationScanRun.update as jest.Mock).mockResolvedValue({
      id: "scan_run_1",
      triggerSource: "operator",
      status: "succeeded",
      requestedScope: "customer_balance",
      customerAccountId: "account_1",
      transactionIntentId: null,
      triggeredByOperatorId: "ops_1",
      triggeredByWorkerId: null,
      startedAt: new Date("2026-04-06T10:00:00.000Z"),
      completedAt: new Date("2026-04-06T10:00:02.000Z"),
      durationMs: 2000,
      createdCount: 1,
      reopenedCount: 0,
      refreshedCount: 0,
      autoResolvedCount: 0,
      activeMismatchCount: 1,
      errorCode: null,
      errorMessage: null,
      resultSnapshot: {
        scannedAt: "2026-04-06T10:00:02.000Z"
      },
      createdAt: new Date("2026-04-06T10:00:00.000Z"),
      updatedAt: new Date("2026-04-06T10:00:02.000Z")
    });
    jest.spyOn(service, "scanMismatches").mockResolvedValue({
      scannedAt: "2026-04-06T10:00:02.000Z",
      createdCount: 1,
      reopenedCount: 0,
      refreshedCount: 0,
      autoResolvedCount: 0,
      activeMismatchCount: 1,
      mismatches: [buildMismatchRecord() as any]
    });

    const result = await service.runTrackedScan(
      {
        scope: "customer_balance",
        customerAccountId: "account_1"
      },
      {
        triggerSource: "operator",
        operatorId: "ops_1"
      }
    );

    expect(prismaService.ledgerReconciliationScanRun.create).toHaveBeenCalled();
    expect(prismaService.ledgerReconciliationScanRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "succeeded",
          createdCount: 1,
          activeMismatchCount: 1
        })
      })
    );
    expect(result.scanRun.status).toBe("succeeded");
    expect(result.result.activeMismatchCount).toBe(1);
  });

  it("records worker-triggered mismatch audit events with worker actor type", async () => {
    const { service, prismaService } = createService();

    jest
      .spyOn(service as any, "buildTransactionIntentCandidates")
      .mockResolvedValue([]);
    jest.spyOn(service as any, "buildBalanceCandidates").mockResolvedValue([
      {
        mismatchKey: "customer_balance:account_1:asset_1",
        scope: LedgerReconciliationMismatchScope.customer_balance,
        severity: LedgerReconciliationMismatchSeverity.critical,
        recommendedAction:
          LedgerReconciliationMismatchRecommendedAction.open_review_case,
        reasonCode: "customer_asset_balance_projection_unrepairable",
        summary: "Projection cannot be repaired safely.",
        chainId: 8453,
        customerId: "customer_1",
        customerAccountId: "account_1",
        transactionIntentId: null,
        assetId: "asset_1",
        linkedReviewCaseId: null,
        latestSnapshot: {
          scope: "customer_balance"
        }
      }
    ]);

    (prismaService.ledgerReconciliationMismatch.findMany as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([buildMismatchRecord()]);
    (prismaService.ledgerReconciliationMismatch.create as jest.Mock).mockResolvedValue(
      buildMismatchRecord()
    );
    (prismaService.auditEvent.create as jest.Mock).mockResolvedValue(undefined);

    await service.scanMismatches(
      {
        scope: "customer_balance",
        customerAccountId: "account_1"
      },
      {
        actorType: "worker",
        actorId: "worker_1"
      }
    );

    expect(prismaService.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorType: "worker",
          actorId: "worker_1",
          action: "ledger_reconciliation.mismatch.opened"
        })
      })
    );
  });

  it("auto-resolves an active linked reconciliation review case when a mismatch clears", async () => {
    const { service, prismaService } = createService();

    jest
      .spyOn(service as any, "buildTransactionIntentCandidates")
      .mockResolvedValue([]);
    jest.spyOn(service as any, "buildBalanceCandidates").mockResolvedValue([]);

    const existingMismatch = buildMismatchRecord({
      linkedReviewCaseId: "review_case_1",
      linkedReviewCase: {
        id: "review_case_1",
        type: ReviewCaseType.reconciliation_review,
        status: ReviewCaseStatus.in_progress,
        assignedOperatorId: "ops_2",
        updatedAt: new Date("2026-04-06T00:06:00.000Z")
      }
    });
    const resolvedMismatch = buildMismatchRecord({
      status: LedgerReconciliationMismatchStatus.resolved,
      recommendedAction: LedgerReconciliationMismatchRecommendedAction.none,
      linkedReviewCaseId: "review_case_1",
      linkedReviewCase: existingMismatch.linkedReviewCase,
      resolvedAt: new Date("2026-04-06T00:10:00.000Z"),
      updatedAt: new Date("2026-04-06T00:10:00.000Z")
    });

    (prismaService.ledgerReconciliationMismatch.findMany as jest.Mock)
      .mockResolvedValueOnce([existingMismatch])
      .mockResolvedValueOnce([]);

    const transaction = {
      ledgerReconciliationMismatch: {
        update: jest.fn().mockResolvedValue(resolvedMismatch)
      },
      reviewCase: {
        update: jest.fn().mockResolvedValue(undefined)
      },
      reviewCaseEvent: {
        create: jest.fn().mockResolvedValue(undefined)
      },
      auditEvent: {
        create: jest.fn().mockResolvedValue(undefined)
      }
    };

    (prismaService.$transaction as jest.Mock).mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction)
    );

    const result = await service.scanMismatches(
      {
        scope: "customer_balance",
        customerAccountId: "account_1"
      },
      {
        actorType: "operator",
        actorId: "ops_1"
      }
    );

    expect(transaction.reviewCase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "review_case_1"
        },
        data: expect.objectContaining({
          status: ReviewCaseStatus.resolved
        })
      })
    );
    expect(transaction.reviewCaseEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reviewCaseId: "review_case_1",
          actorType: "operator",
          actorId: "ops_1",
          eventType: "resolved"
        })
      })
    );
    expect(transaction.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          targetType: "ReviewCase",
          targetId: "review_case_1",
          action: "review_case.resolved"
        })
      })
    );
    expect(result.autoResolvedCount).toBe(1);
    expect(result.activeMismatchCount).toBe(0);
  });
});
