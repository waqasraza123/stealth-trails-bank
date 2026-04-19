jest.mock("@stealth-trails-bank/config/api", () => ({
  loadProductChainRuntimeConfig: () => ({
    productChainId: 8453
  })
}));

import { ConflictException } from "@nestjs/common";
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
import { DepositSettlementReconciliationService } from "../transaction-intents/deposit-settlement-reconciliation.service";
import { TransactionIntentsService } from "../transaction-intents/transaction-intents.service";
import { WithdrawalSettlementReconciliationService } from "../transaction-intents/withdrawal-settlement-reconciliation.service";
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
    depositSettlementReplayApprovalRequest: {
      findMany: jest.fn()
    },
    withdrawalSettlementReplayApprovalRequest: {
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

  const transactionIntentsService = {
    replayConfirmDepositIntent: jest.fn(),
    replaySettleConfirmedDepositIntent: jest.fn()
  } as unknown as TransactionIntentsService;
  const withdrawalIntentsService = {
    replayConfirmWithdrawalIntent: jest.fn(),
    replaySettleConfirmedWithdrawalIntent: jest.fn()
  } as unknown as WithdrawalIntentsService;
  const depositSettlementReconciliationService = {
    requestReplayApproval: jest.fn()
  } as unknown as DepositSettlementReconciliationService;
  const withdrawalSettlementReconciliationService = {
    requestReplayApproval: jest.fn()
  } as unknown as WithdrawalSettlementReconciliationService;
  const reviewCasesService = {
    openOrReuseReviewCase: jest.fn()
  } as unknown as ReviewCasesService;

  return {
    prismaService,
    transactionIntentsService,
    withdrawalIntentsService,
    depositSettlementReconciliationService,
    withdrawalSettlementReconciliationService,
    reviewCasesService,
    service: new LedgerReconciliationService(
      prismaService,
      transactionIntentsService,
      withdrawalIntentsService,
      depositSettlementReconciliationService,
      withdrawalSettlementReconciliationService,
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

  it("routes governed replay approval requests through deposit reconciliation controls", async () => {
    const { service, depositSettlementReconciliationService } = createService();

    const mismatch = buildMismatchRecord({
      scope: LedgerReconciliationMismatchScope.transaction_intent,
      transactionIntentId: "intent_1",
      transactionIntent: {
        transactionIntentId: "intent_1",
        intentType: TransactionIntentType.deposit,
        status: TransactionIntentStatus.broadcast,
        policyDecision: PolicyDecision.approved,
        requestedAmount: "5.00",
        settledAmount: null,
        createdAt: new Date("2026-04-06T00:00:00.000Z"),
        updatedAt: new Date("2026-04-06T00:05:00.000Z")
      }
    });

    jest.spyOn(service as any, "findMismatchById").mockResolvedValue(mismatch);
    (
      depositSettlementReconciliationService.requestReplayApproval as jest.Mock
    ).mockResolvedValue({
      request: {
        id: "approval_1",
        transactionIntentId: "intent_1",
        chainId: 8453,
        replayAction: "confirm",
        status: "pending_approval",
        requestedByOperatorId: "ops_1",
        requestedByOperatorRole: "operations_admin",
        requestNote: "Replay confirm requires approval.",
        requestedAt: "2026-04-06T01:00:00.000Z",
        approvedByOperatorId: null,
        approvedByOperatorRole: null,
        approvalNote: null,
        approvedAt: null,
        executedByOperatorId: null,
        executedByOperatorRole: null,
        executedAt: null
      },
      stateReused: false
    });

    const result = await service.requestReplayApprovalForMismatch(
      "mismatch_1",
      "ops_1",
      "operations_admin",
      {
        replayAction: "confirm",
        note: "Replay confirm requires approval."
      }
    );

    expect(
      depositSettlementReconciliationService.requestReplayApproval
    ).toHaveBeenCalledWith("intent_1", "ops_1", "operations_admin", {
      replayAction: "confirm",
      note: "Replay confirm requires approval."
    });
    expect(result.request.id).toBe("approval_1");
    expect(result.request.intentType).toBe(TransactionIntentType.deposit);
    expect(result.stateReused).toBe(false);
  });

  it("includes active replay approval requests in the mismatch workspace", async () => {
    const { service, prismaService } = createService();

    const mismatch = buildMismatchRecord({
      scope: LedgerReconciliationMismatchScope.transaction_intent,
      transactionIntentId: "intent_1",
      transactionIntent: {
        transactionIntentId: "intent_1",
        intentType: TransactionIntentType.deposit,
        status: TransactionIntentStatus.broadcast,
        policyDecision: PolicyDecision.approved,
        requestedAmount: "5.00",
        settledAmount: null,
        createdAt: new Date("2026-04-06T00:00:00.000Z"),
        updatedAt: new Date("2026-04-06T00:05:00.000Z")
      }
    });

    jest.spyOn(service as any, "findMismatchById").mockResolvedValue(mismatch);
    jest.spyOn(service as any, "buildTransactionIntentCandidates").mockResolvedValue([
      {
        latestSnapshot: {
          reconciliationState: "ready_for_confirm_replay"
        }
      }
    ]);
    (
      prismaService.depositSettlementReplayApprovalRequest.findMany as jest.Mock
    ).mockResolvedValue([
      {
        id: "approval_1",
        transactionIntentId: "intent_1",
        chainId: 8453,
        replayAction: "confirm",
        status: "pending_approval",
        requestedByOperatorId: "ops_requester",
        requestedByOperatorRole: "operations_admin",
        requestNote: "Need confirm replay.",
        requestedAt: new Date("2026-04-06T01:00:00.000Z"),
        approvedByOperatorId: null,
        approvedByOperatorRole: null,
        approvalNote: null,
        approvedAt: null,
        executedByOperatorId: null,
        executedByOperatorRole: null,
        executedAt: null
      }
    ]);
    (prismaService.auditEvent.findMany as jest.Mock).mockResolvedValue([]);

    const result = await service.getMismatchWorkspace("mismatch_1", {
      recentAuditLimit: 10
    });

    expect(result.replayApprovalRequests).toEqual([
      expect.objectContaining({
        id: "approval_1",
        replayAction: "confirm",
        status: "pending_approval",
        intentType: TransactionIntentType.deposit
      })
    ]);
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

  it("dismisses an open mismatch and emits exactly one operator audit event", async () => {
    const { service, prismaService } = createService();
    const mismatch = buildMismatchRecord();
    const dismissedMismatch = buildMismatchRecord({
      status: LedgerReconciliationMismatchStatus.dismissed,
      dismissedAt: new Date("2026-04-06T00:12:00.000Z"),
      dismissedByOperatorId: "ops_1",
      resolutionNote: "No repair needed."
    });

    jest.spyOn(service as any, "findMismatchById").mockResolvedValue(mismatch);
    (prismaService.ledgerReconciliationMismatch.update as jest.Mock).mockResolvedValue(
      dismissedMismatch
    );
    (prismaService.auditEvent.create as jest.Mock).mockResolvedValue(undefined);

    const result = await service.dismissMismatch(
      "mismatch_1",
      "ops_1",
      "No repair needed."
    );

    expect(prismaService.ledgerReconciliationMismatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "mismatch_1"
        },
        data: expect.objectContaining({
          status: LedgerReconciliationMismatchStatus.dismissed,
          dismissedByOperatorId: "ops_1",
          resolutionNote: "No repair needed."
        })
      })
    );
    expect(prismaService.auditEvent.create).toHaveBeenCalledTimes(1);
    expect(prismaService.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorType: "operator",
          actorId: "ops_1",
          action: "ledger_reconciliation.mismatch.dismissed",
          targetType: "LedgerReconciliationMismatch",
          targetId: "mismatch_1"
        })
      })
    );
    expect(result.mismatch.status).toBe("dismissed");
  });

  it("rejects dismissing a mismatch that is already resolved", async () => {
    const { service } = createService();

    jest.spyOn(service as any, "findMismatchById").mockResolvedValue(
      buildMismatchRecord({
        status: LedgerReconciliationMismatchStatus.resolved
      })
    );

    await expect(
      service.dismissMismatch("mismatch_1", "ops_1", null)
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("requires governed approval context before replaying a mismatch", async () => {
    const { service } = createService();

    jest.spyOn(service as any, "findMismatchById").mockResolvedValue(
      buildMismatchRecord({
        scope: LedgerReconciliationMismatchScope.transaction_intent,
        recommendedAction:
          LedgerReconciliationMismatchRecommendedAction.replay_confirm,
        transactionIntentId: "intent_1",
        transactionIntent: {
          id: "intent_1",
          intentType: TransactionIntentType.deposit,
          status: TransactionIntentStatus.broadcast,
          policyDecision: PolicyDecision.approved,
          requestedAmount: new Prisma.Decimal("10"),
          settledAmount: null,
          createdAt: new Date("2026-04-06T00:00:00.000Z"),
          updatedAt: new Date("2026-04-06T00:00:00.000Z")
        }
      })
    );

    await expect(
      service.replayConfirmMismatch(
        "mismatch_1",
        "ops_1",
        "operations_admin",
        null,
        null
      )
    ).rejects.toThrow(
      "Governed replay approval is required before replaying ledger reconciliation mismatches."
    );
  });

  it("forwards governed approval context to deposit mismatch replay", async () => {
    const { service, transactionIntentsService } = createService();

    jest.spyOn(service as any, "findMismatchById").mockResolvedValue(
      buildMismatchRecord({
        scope: LedgerReconciliationMismatchScope.transaction_intent,
        recommendedAction:
          LedgerReconciliationMismatchRecommendedAction.replay_confirm,
        transactionIntentId: "intent_1",
        mismatchKey: "transaction_intent:intent_1",
        transactionIntent: {
          id: "intent_1",
          intentType: TransactionIntentType.deposit,
          status: TransactionIntentStatus.broadcast,
          policyDecision: PolicyDecision.approved,
          requestedAmount: new Prisma.Decimal("10"),
          settledAmount: null,
          createdAt: new Date("2026-04-06T00:00:00.000Z"),
          updatedAt: new Date("2026-04-06T00:00:00.000Z")
        }
      })
    );
    jest
      .spyOn(service as any, "refreshMismatchAfterTargetedScan")
      .mockResolvedValue(
        buildMismatchRecord({
          scope: LedgerReconciliationMismatchScope.transaction_intent,
          recommendedAction: LedgerReconciliationMismatchRecommendedAction.none,
          transactionIntentId: "intent_1",
          mismatchKey: "transaction_intent:intent_1"
        })
      );

    (transactionIntentsService.replayConfirmDepositIntent as jest.Mock).mockResolvedValue(
      {
        confirmReused: false
      }
    );

    await service.replayConfirmMismatch(
      "mismatch_1",
      "ops_approver",
      "operations_admin",
      "approval_1",
      "Replay from mismatch."
    );

    expect(
      transactionIntentsService.replayConfirmDepositIntent
    ).toHaveBeenCalledWith(
      "intent_1",
      "ops_approver",
      "Replay from mismatch.",
      "operations_admin",
      {
        approvalRequestId: "approval_1",
        requestedByOperatorId: null,
        requestedByOperatorRole: null
      }
    );
  });

  it("forwards governed approval context to withdrawal mismatch settlement replay", async () => {
    const { service, withdrawalIntentsService } = createService();

    jest.spyOn(service as any, "findMismatchById").mockResolvedValue(
      buildMismatchRecord({
        scope: LedgerReconciliationMismatchScope.transaction_intent,
        recommendedAction:
          LedgerReconciliationMismatchRecommendedAction.replay_settle,
        transactionIntentId: "intent_2",
        mismatchKey: "transaction_intent:intent_2",
        transactionIntent: {
          id: "intent_2",
          intentType: TransactionIntentType.withdrawal,
          status: TransactionIntentStatus.confirmed,
          policyDecision: PolicyDecision.approved,
          requestedAmount: new Prisma.Decimal("10"),
          settledAmount: null,
          createdAt: new Date("2026-04-06T00:00:00.000Z"),
          updatedAt: new Date("2026-04-06T00:00:00.000Z")
        }
      })
    );
    jest
      .spyOn(service as any, "refreshMismatchAfterTargetedScan")
      .mockResolvedValue(
        buildMismatchRecord({
          scope: LedgerReconciliationMismatchScope.transaction_intent,
          recommendedAction: LedgerReconciliationMismatchRecommendedAction.none,
          transactionIntentId: "intent_2",
          mismatchKey: "transaction_intent:intent_2"
        })
      );

    (
      withdrawalIntentsService.replaySettleConfirmedWithdrawalIntent as jest.Mock
    ).mockResolvedValue({
      settlementReused: false
    });

    await service.replaySettleMismatch(
      "mismatch_1",
      "ops_approver",
      "operations_admin",
      "approval_2",
      "Replay settle from mismatch."
    );

    expect(
      withdrawalIntentsService.replaySettleConfirmedWithdrawalIntent
    ).toHaveBeenCalledWith(
      "intent_2",
      "ops_approver",
      "Replay settle from mismatch.",
      "operations_admin",
      {
        approvalRequestId: "approval_2",
        requestedByOperatorId: null,
        requestedByOperatorRole: null
      }
    );
  });
});
