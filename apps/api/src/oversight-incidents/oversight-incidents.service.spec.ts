import { ConflictException } from "@nestjs/common";
import {
  AccountLifecycleStatus,
  OversightIncidentStatus,
  OversightIncidentType,
  Prisma,
  TransactionIntentType
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ReviewCasesService } from "../review-cases/review-cases.service";
import { OversightIncidentsService } from "./oversight-incidents.service";

function buildManuallyResolvedIntent(
  overrides: Partial<Record<string, unknown>> = {}
) {
  return {
    id: "intent_1",
    customerAccountId: "account_1",
    intentType: TransactionIntentType.withdrawal,
    requestedAmount: new Prisma.Decimal("30"),
    settledAmount: null,
    failureCode: "policy_denied",
    failureReason: "Manual review rejected.",
    externalAddress: "0x0000000000000000000000000000000000000abc",
    manuallyResolvedAt: new Date("2026-04-01T00:30:00.000Z"),
    manualResolutionReasonCode: "support_case_closed",
    manualResolutionNote: "Handled off-platform.",
    manualResolvedByOperatorId: "ops_1",
    manualResolutionOperatorRole: "operations_admin",
    manualResolutionReviewCaseId: "review_case_1",
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

function buildOversightIncident(
  overrides: Partial<Record<string, unknown>> = {}
) {
  return {
    id: "incident_1",
    incidentType: OversightIncidentType.customer_manual_resolution_spike,
    status: OversightIncidentStatus.open,
    reasonCode: "manual_resolution_threshold_exceeded",
    summaryNote: "Threshold exceeded.",
    subjectCustomerId: "customer_1",
    subjectCustomerAccountId: "account_1",
    subjectOperatorId: null,
    subjectOperatorRole: null,
    assignedOperatorId: null,
    openedAt: new Date("2026-04-01T01:00:00.000Z"),
    startedAt: null,
    resolvedAt: null,
    dismissedAt: null,
    createdAt: new Date("2026-04-01T01:00:00.000Z"),
    updatedAt: new Date("2026-04-01T01:00:00.000Z"),
    subjectCustomer: {
      id: "customer_1",
      supabaseUserId: "supabase_1",
      email: "user@example.com",
      firstName: "Waqas",
      lastName: "Raza"
    },
    subjectCustomerAccount: {
      id: "account_1",
      customerId: "customer_1",
      status: AccountLifecycleStatus.active,
      restrictedAt: null,
      restrictedFromStatus: null,
      restrictionReasonCode: null,
      restrictedByOperatorId: null,
      restrictedByOversightIncidentId: null,
      restrictionReleasedAt: null,
      restrictionReleasedByOperatorId: null
    },
    ...overrides
  };
}

function createService() {
  const prismaService = {
    transactionIntent: {
      findMany: jest.fn()
    },
    oversightIncident: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    },
    oversightIncidentEvent: {
      findMany: jest.fn(),
      create: jest.fn()
    },
    reviewCase: {
      findMany: jest.fn()
    },
    auditEvent: {
      create: jest.fn()
    },
    $transaction: jest.fn()
  } as unknown as PrismaService;

  const reviewCasesService = {
    openOrReuseReviewCase: jest.fn()
  } as unknown as ReviewCasesService;

  const service = new OversightIncidentsService(prismaService, reviewCasesService);

  return {
    service,
    prismaService
  };
}

describe("OversightIncidentsService", () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("detects a customer manual resolution spike alert", async () => {
    const { service, prismaService } = createService();

    (prismaService.transactionIntent.findMany as jest.Mock).mockResolvedValue([
      buildManuallyResolvedIntent(),
      buildManuallyResolvedIntent({
        id: "intent_2",
        manualResolutionReviewCaseId: "review_case_2"
      })
    ]);

    (prismaService.oversightIncident.findMany as jest.Mock).mockResolvedValue([]);

    const result = await service.listOversightAlerts({
      sinceDays: 30,
      customerThreshold: 2,
      operatorThreshold: 2
    });

    expect(result.alerts).toHaveLength(2);
    expect(
      result.alerts.some(
        (alert) =>
          alert.incidentType ===
          OversightIncidentType.customer_manual_resolution_spike
      )
    ).toBe(true);
  });

  it("opens a customer oversight incident when threshold is met", async () => {
    const { service, prismaService } = createService();

    (prismaService.transactionIntent.findMany as jest.Mock).mockResolvedValue([
      buildManuallyResolvedIntent(),
      buildManuallyResolvedIntent({
        id: "intent_2"
      })
    ]);

    (prismaService.oversightIncident.findFirst as jest.Mock).mockResolvedValue(
      null
    );

    const transaction = {
      oversightIncident: {
        create: jest.fn().mockResolvedValue(buildOversightIncident())
      },
      oversightIncidentEvent: {
        create: jest.fn().mockResolvedValue(undefined)
      },
      auditEvent: {
        create: jest.fn().mockResolvedValue(undefined)
      }
    };

    (prismaService.$transaction as jest.Mock).mockImplementation(
      async (callback: (tx: any) => Promise<unknown>) => callback(transaction)
    );

    const result = await service.openCustomerOversightIncident(
      "account_1",
      "ops_1",
      {
        sinceDays: 30,
        threshold: 2
      }
    );

    expect(result.oversightIncidentReused).toBe(false);
    expect(result.oversightIncident.incidentType).toBe(
      OversightIncidentType.customer_manual_resolution_spike
    );
  });

  it("rejects customer oversight incident creation below threshold", async () => {
    const { service, prismaService } = createService();

    (prismaService.transactionIntent.findMany as jest.Mock).mockResolvedValue([
      buildManuallyResolvedIntent()
    ]);

    await expect(
      service.openCustomerOversightIncident("account_1", "ops_1", {
        sinceDays: 30,
        threshold: 2
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("returns an oversight incident workspace", async () => {
    const { service, prismaService } = createService();

    (prismaService.oversightIncident.findUnique as jest.Mock).mockResolvedValue(
      buildOversightIncident()
    );

    (prismaService.oversightIncidentEvent.findMany as jest.Mock).mockResolvedValue([
      {
        id: "event_1",
        oversightIncidentId: "incident_1",
        actorType: "operator",
        actorId: "ops_1",
        eventType: "opened",
        note: "Threshold exceeded.",
        metadata: null,
        createdAt: new Date("2026-04-01T01:00:00.000Z")
      }
    ]);

    (prismaService.transactionIntent.findMany as jest.Mock).mockResolvedValue([
      buildManuallyResolvedIntent()
    ]);

    (prismaService.reviewCase.findMany as jest.Mock).mockResolvedValue([
      {
        id: "review_case_1",
        type: "withdrawal_review",
        status: "resolved",
        reasonCode: "policy_denied",
        assignedOperatorId: "ops_1",
        transactionIntentId: "intent_1",
        customerAccountId: "account_1",
        updatedAt: new Date("2026-04-01T00:30:00.000Z"),
        resolvedAt: new Date("2026-04-01T00:30:00.000Z")
      }
    ]);

    const result = await service.getOversightIncidentWorkspace(
      "incident_1",
      {
        recentLimit: 10
      },
      "risk_manager"
    );

    expect(result.events).toHaveLength(1);
    expect(result.recentManuallyResolvedIntents).toHaveLength(1);
    expect(result.recentReviewCases).toHaveLength(1);
    expect(result.accountHoldGovernance).toEqual({
      operatorRole: "risk_manager",
      canApplyAccountHold: true,
      canReleaseAccountHold: false,
      allowedApplyOperatorRoles: ["operations_admin", "risk_manager"],
      allowedReleaseOperatorRoles: [
        "operations_admin",
        "risk_manager",
        "compliance_lead"
      ]
    });
  });

  it("starts an oversight incident and assigns the operator", async () => {
    const { service, prismaService } = createService();

    (prismaService.oversightIncident.findUnique as jest.Mock).mockResolvedValue(
      buildOversightIncident()
    );

    const transaction = {
      oversightIncident: {
        update: jest.fn().mockResolvedValue(
          buildOversightIncident({
            status: OversightIncidentStatus.in_progress,
            assignedOperatorId: "ops_1",
            startedAt: new Date("2026-04-01T01:05:00.000Z")
          })
        )
      },
      oversightIncidentEvent: {
        create: jest.fn().mockResolvedValue(undefined)
      },
      auditEvent: {
        create: jest.fn().mockResolvedValue(undefined)
      }
    };

    (prismaService.$transaction as jest.Mock).mockImplementation(
      async (callback: (tx: any) => Promise<unknown>) => callback(transaction)
    );

    const result = await service.startOversightIncident("incident_1", "ops_1", {
      note: "Taking ownership."
    });

    expect(result.stateReused).toBe(false);
    expect(result.oversightIncident.status).toBe(
      OversightIncidentStatus.in_progress
    );
    expect(result.oversightIncident.assignedOperatorId).toBe("ops_1");
  });
});
