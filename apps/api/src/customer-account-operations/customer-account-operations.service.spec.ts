import { BadRequestException } from "@nestjs/common";
import {
  AccountLifecycleStatus,
  ReviewCaseStatus,
  TransactionIntentStatus,
  TransactionIntentType
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CustomerAccountOperationsService } from "./customer-account-operations.service";

function createService() {
  const prismaService = {
    customerAccount: {
      findFirst: jest.fn()
    },
    transactionIntent: {
      findMany: jest.fn(),
      count: jest.fn()
    },
    reviewCaseEvent: {
      findMany: jest.fn()
    },
    oversightIncidentEvent: {
      findMany: jest.fn()
    },
    retirementVaultEvent: {
      findMany: jest.fn()
    },
    customerAccountRestriction: {
      findMany: jest.fn(),
      count: jest.fn()
    },
    reviewCase: {
      count: jest.fn()
    },
    oversightIncident: {
      count: jest.fn()
    }
  } as unknown as PrismaService;

  const service = new CustomerAccountOperationsService(prismaService);

  return {
    service,
    prismaService
  };
}

function buildCustomerAccountSummary() {
  return {
    id: "account_1",
    status: AccountLifecycleStatus.restricted,
    restrictedAt: new Date("2026-04-01T01:10:00.000Z"),
    restrictedFromStatus: AccountLifecycleStatus.active,
    restrictionReasonCode: "oversight_risk_hold",
    restrictedByOperatorId: "ops_1",
    restrictedByOversightIncidentId: "incident_1",
    restrictionReleasedAt: null,
    restrictionReleasedByOperatorId: null,
    customer: {
      id: "customer_1",
      supabaseUserId: "supabase_1",
      email: "user@example.com",
      firstName: "Waqas",
      lastName: "Raza"
    }
  };
}

describe("CustomerAccountOperationsService", () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("returns a unified customer account timeline across domain sources", async () => {
    const { service, prismaService } = createService();

    (prismaService.customerAccount.findFirst as jest.Mock).mockResolvedValue(
      buildCustomerAccountSummary()
    );

    (prismaService.transactionIntent.findMany as jest.Mock).mockResolvedValue([
      {
        id: "intent_1",
        intentType: TransactionIntentType.withdrawal,
        status: TransactionIntentStatus.manually_resolved,
        policyDecision: "denied",
        requestedAmount: { toString: () => "30" },
        settledAmount: null,
        failureCode: "policy_denied",
        failureReason: "Manual review rejected.",
        manuallyResolvedAt: new Date("2026-04-01T00:30:00.000Z"),
        manualResolutionReasonCode: "support_case_closed",
        manualResolutionNote: "Handled off-platform.",
        manualResolvedByOperatorId: "ops_1",
        manualResolutionOperatorRole: "operations_admin",
        manualResolutionReviewCaseId: "review_case_1",
        sourceWalletId: "wallet_1",
        destinationWalletId: null,
        externalAddress: "0x0000000000000000000000000000000000000abc",
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        updatedAt: new Date("2026-04-01T00:30:00.000Z"),
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
        blockchainTransactions: []
      }
    ]);

    (prismaService.reviewCaseEvent.findMany as jest.Mock).mockResolvedValue([
      {
        id: "review_event_1",
        actorType: "operator",
        actorId: "ops_1",
        eventType: "note_added",
        note: "Investigated manually resolved withdrawal.",
        metadata: null,
        createdAt: new Date("2026-04-01T00:20:00.000Z"),
        reviewCase: {
          id: "review_case_1",
          type: "withdrawal_review",
          status: ReviewCaseStatus.in_progress,
          reasonCode: "policy_denied",
          transactionIntentId: "intent_1",
          assignedOperatorId: "ops_1"
        }
      }
    ]);

    (prismaService.oversightIncidentEvent.findMany as jest.Mock).mockResolvedValue([
      {
        id: "oversight_event_1",
        actorType: "operator",
        actorId: "ops_2",
        eventType: "opened",
        note: "Manual resolution spike detected.",
        metadata: null,
        createdAt: new Date("2026-04-01T01:00:00.000Z"),
        oversightIncident: {
          id: "incident_1",
          incidentType: "customer_manual_resolution_spike",
          status: "open",
          reasonCode: "manual_resolution_threshold_exceeded",
          assignedOperatorId: null,
          subjectOperatorId: null
        }
      }
    ]);
    (prismaService.retirementVaultEvent.findMany as jest.Mock).mockResolvedValue([]);

    (prismaService.customerAccountRestriction.findMany as jest.Mock).mockResolvedValue([
      {
        id: "restriction_1",
        oversightIncidentId: "incident_1",
        restrictionReasonCode: "oversight_risk_hold",
        appliedByOperatorId: "ops_1",
        appliedByOperatorRole: "risk_manager",
        appliedNote: "Temporary hold.",
        previousStatus: "active",
        appliedAt: new Date("2026-04-01T01:10:00.000Z"),
        releasedAt: null,
        releasedByOperatorId: null,
        releasedByOperatorRole: null,
        releaseNote: null,
        restoredStatus: null,
        releaseDecisionStatus: "pending",
        releaseReviewCaseId: "review_case_2",
        oversightIncident: {
          id: "incident_1",
          incidentType: "customer_manual_resolution_spike",
          status: "in_progress",
          reasonCode: "manual_resolution_threshold_exceeded"
        },
        releaseReviewCase: {
          id: "review_case_2",
          type: "account_review",
          status: "in_progress"
        }
      }
    ]);

    (prismaService.transactionIntent.count as jest.Mock)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(1);

    (prismaService.reviewCase.count as jest.Mock).mockResolvedValue(2);
    (prismaService.oversightIncident.count as jest.Mock).mockResolvedValue(1);
    (prismaService.customerAccountRestriction.count as jest.Mock).mockResolvedValue(1);

    const result = await service.listCustomerAccountTimeline({
      customerAccountId: "account_1",
      limit: 20
    });

    expect(result.summary.customer.customerAccountId).toBe("account_1");
    expect(result.summary.accountStatus).toBe(AccountLifecycleStatus.restricted);
    expect(result.summary.currentRestriction.active).toBe(true);
    expect(result.summary.counts.totalTransactionIntents).toBe(5);
    expect(result.timeline.length).toBeGreaterThan(0);
    expect(
      result.timeline[0].occurredAt >=
        result.timeline[result.timeline.length - 1].occurredAt
    ).toBe(true);
  });

  it("filters the unified timeline by event type and actor id", async () => {
    const { service, prismaService } = createService();

    (prismaService.customerAccount.findFirst as jest.Mock).mockResolvedValue(
      buildCustomerAccountSummary()
    );

    (prismaService.transactionIntent.findMany as jest.Mock).mockResolvedValue([]);
    (prismaService.reviewCaseEvent.findMany as jest.Mock).mockResolvedValue([
      {
        id: "review_event_1",
        actorType: "operator",
        actorId: "ops_1",
        eventType: "note_added",
        note: "Investigation note.",
        metadata: null,
        createdAt: new Date("2026-04-01T00:20:00.000Z"),
        reviewCase: {
          id: "review_case_1",
          type: "withdrawal_review",
          status: ReviewCaseStatus.in_progress,
          reasonCode: "policy_denied",
          transactionIntentId: "intent_1",
          assignedOperatorId: "ops_1"
        }
      }
    ]);
    (prismaService.oversightIncidentEvent.findMany as jest.Mock).mockResolvedValue([]);
    (prismaService.retirementVaultEvent.findMany as jest.Mock).mockResolvedValue([]);
    (prismaService.customerAccountRestriction.findMany as jest.Mock).mockResolvedValue([]);
    (prismaService.transactionIntent.count as jest.Mock)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    (prismaService.reviewCase.count as jest.Mock).mockResolvedValue(1);
    (prismaService.oversightIncident.count as jest.Mock).mockResolvedValue(0);
    (prismaService.customerAccountRestriction.count as jest.Mock).mockResolvedValue(0);

    const result = await service.listCustomerAccountTimeline({
      customerAccountId: "account_1",
      limit: 20,
      eventType: "review_case.note_added",
      actorId: "ops_1"
    });

    expect(result.timeline).toHaveLength(1);
    expect(result.timeline[0].eventType).toBe("review_case.note_added");
    expect(result.timeline[0].actorId).toBe("ops_1");
  });

  it("rejects requests without a customer account lookup key", async () => {
    const { service } = createService();

    await expect(
      service.listCustomerAccountTimeline({
        limit: 20
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
