import {
  ConflictException,
  ForbiddenException
} from "@nestjs/common";
import {
  AccountLifecycleStatus,
  CustomerAccountRestrictionReleaseDecisionStatus,
  CustomerAccountRestrictionStatus,
  OversightIncidentStatus,
  OversightIncidentType,
  ReviewCaseStatus,
  ReviewCaseType
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AccountRestrictionReleaseReviewService } from "./account-restriction-release-review.service";

function buildReviewCase(
  overrides: Partial<Record<string, unknown>> = {}
) {
  return {
    id: "review_case_1",
    customerId: "customer_1",
    customerAccountId: "account_1",
    type: ReviewCaseType.account_review,
    status: ReviewCaseStatus.open,
    reasonCode: null,
    notes: "Review the active account hold.",
    assignedOperatorId: null,
    startedAt: null,
    resolvedAt: null,
    dismissedAt: null,
    createdAt: new Date("2026-04-02T00:00:00.000Z"),
    updatedAt: new Date("2026-04-02T00:00:00.000Z"),
    ...overrides
  };
}

function buildRestriction(
  overrides: Partial<Record<string, unknown>> = {}
) {
  return {
    id: "restriction_1",
    customerAccountId: "account_1",
    oversightIncidentId: "incident_1",
    status: CustomerAccountRestrictionStatus.active,
    restrictionReasonCode: "oversight_risk_hold",
    appliedByOperatorId: "ops_1",
    appliedByOperatorRole: "risk_manager",
    appliedNote: "Applied after threshold breach.",
    previousStatus: AccountLifecycleStatus.active,
    appliedAt: new Date("2026-04-02T00:00:00.000Z"),
    releasedAt: null,
    releasedByOperatorId: null,
    releasedByOperatorRole: null,
    releaseNote: null,
    restoredStatus: null,
    releaseDecisionStatus:
      CustomerAccountRestrictionReleaseDecisionStatus.not_requested,
    releaseRequestedAt: null,
    releaseRequestedByOperatorId: null,
    releaseRequestNote: null,
    releaseDecidedAt: null,
    releaseDecidedByOperatorId: null,
    releaseDecisionNote: null,
    releaseReviewCaseId: "review_case_1",
    createdAt: new Date("2026-04-02T00:00:00.000Z"),
    updatedAt: new Date("2026-04-02T00:00:00.000Z"),
    customerAccount: {
      id: "account_1",
      customerId: "customer_1",
      status: AccountLifecycleStatus.restricted,
      restrictedAt: new Date("2026-04-02T00:00:00.000Z"),
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
    },
    oversightIncident: {
      id: "incident_1",
      incidentType: OversightIncidentType.customer_manual_resolution_spike,
      status: OversightIncidentStatus.in_progress,
      reasonCode: "manual_resolution_threshold_exceeded",
      summaryNote: "Threshold exceeded.",
      assignedOperatorId: "ops_1",
      openedAt: new Date("2026-04-02T00:00:00.000Z"),
      updatedAt: new Date("2026-04-02T00:00:00.000Z")
    },
    releaseReviewCase: buildReviewCase(),
    ...overrides
  };
}

function createService() {
  const prismaService = {
    reviewCase: {
      findUnique: jest.fn(),
      update: jest.fn()
    },
    reviewCaseEvent: {
      create: jest.fn()
    },
    oversightIncidentEvent: {
      create: jest.fn()
    },
    customerAccount: {
      updateMany: jest.fn()
    },
    customerAccountRestriction: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      updateMany: jest.fn()
    },
    auditEvent: {
      create: jest.fn()
    },
    $transaction: jest.fn()
  } as unknown as PrismaService;

  const service = new AccountRestrictionReleaseReviewService(prismaService);

  return {
    service,
    prismaService
  };
}

describe("AccountRestrictionReleaseReviewService", () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("requests account release from a linked account review case", async () => {
    const { service, prismaService } = createService();

    (prismaService.reviewCase.findUnique as jest.Mock).mockResolvedValue(
      buildReviewCase()
    );
    (prismaService.customerAccountRestriction.findFirst as jest.Mock).mockResolvedValue(
      buildRestriction()
    );

    const transaction = {
      customerAccountRestriction: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(
          buildRestriction({
            releaseDecisionStatus:
              CustomerAccountRestrictionReleaseDecisionStatus.pending,
            releaseRequestedAt: new Date("2026-04-03T00:00:00.000Z"),
            releaseRequestedByOperatorId: "ops_2",
            releaseRequestNote: "Escalating for approval."
          })
        )
      },
      reviewCaseEvent: {
        create: jest.fn().mockResolvedValue(undefined)
      },
      auditEvent: {
        create: jest.fn().mockResolvedValue(undefined)
      }
    };

    (prismaService.$transaction as jest.Mock).mockImplementation(
      async (callback: (tx: any) => Promise<unknown>) => callback(transaction)
    );

    const result = await service.requestAccountRelease("review_case_1", "ops_2", {
      note: "Escalating for approval."
    });

    expect(result.stateReused).toBe(false);
    expect(result.accountReleaseReview.restriction.releaseDecisionStatus).toBe(
      CustomerAccountRestrictionReleaseDecisionStatus.pending
    );
    expect(transaction.customerAccountRestriction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "restriction_1",
          status: CustomerAccountRestrictionStatus.active
        },
        data: expect.objectContaining({
          releaseDecisionStatus:
            CustomerAccountRestrictionReleaseDecisionStatus.pending,
          releaseRequestedByOperatorId: "ops_2",
          releaseRequestNote: "Escalating for approval."
        })
      })
    );
  });

  it("lists pending account release reviews", async () => {
    const { service, prismaService } = createService();

    (prismaService.customerAccountRestriction.findMany as jest.Mock).mockResolvedValue(
      [
        buildRestriction({
          releaseDecisionStatus:
            CustomerAccountRestrictionReleaseDecisionStatus.pending,
          releaseRequestedAt: new Date("2026-04-03T00:00:00.000Z"),
          releaseRequestedByOperatorId: "ops_2"
        })
      ]
    );

    const result = await service.listPendingAccountReleaseReviews({
      limit: 20
    });

    expect(result.reviews).toHaveLength(1);
    expect(result.reviews[0].restriction.releaseDecisionStatus).toBe(
      CustomerAccountRestrictionReleaseDecisionStatus.pending
    );
  });

  it("approves account release and restores the prior account status", async () => {
    const { service, prismaService } = createService();

    (prismaService.reviewCase.findUnique as jest.Mock).mockResolvedValue(
      buildReviewCase({
        status: ReviewCaseStatus.in_progress,
        assignedOperatorId: "ops_2"
      })
    );
    (prismaService.customerAccountRestriction.findFirst as jest.Mock).mockResolvedValue(
      buildRestriction({
        releaseDecisionStatus:
          CustomerAccountRestrictionReleaseDecisionStatus.pending,
        releaseRequestedAt: new Date("2026-04-03T00:00:00.000Z"),
        releaseRequestedByOperatorId: "ops_2"
      })
    );

    const transaction = {
      customerAccountRestriction: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(
          buildRestriction({
            status: CustomerAccountRestrictionStatus.released,
            releasedAt: new Date("2026-04-03T01:00:00.000Z"),
            releasedByOperatorId: "ops_3",
            releasedByOperatorRole: "compliance_lead",
            releaseNote: "Release approved.",
            restoredStatus: AccountLifecycleStatus.active,
            releaseDecisionStatus:
              CustomerAccountRestrictionReleaseDecisionStatus.approved,
            releaseRequestedAt: new Date("2026-04-03T00:00:00.000Z"),
            releaseRequestedByOperatorId: "ops_2",
            releaseDecidedAt: new Date("2026-04-03T01:00:00.000Z"),
            releaseDecidedByOperatorId: "ops_3",
            releaseDecisionNote: "Release approved.",
            customerAccount: {
              ...buildRestriction().customerAccount,
              status: AccountLifecycleStatus.active,
              restrictionReleasedAt: new Date("2026-04-03T01:00:00.000Z"),
              restrictionReleasedByOperatorId: "ops_3"
            },
            releaseReviewCase: buildReviewCase({
              status: ReviewCaseStatus.resolved,
              assignedOperatorId: "ops_2",
              resolvedAt: new Date("2026-04-03T01:00:00.000Z")
            })
          })
        )
      },
      customerAccount: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      reviewCase: {
        update: jest.fn().mockResolvedValue(undefined)
      },
      reviewCaseEvent: {
        create: jest.fn().mockResolvedValue(undefined)
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

    const result = await service.decideAccountRelease(
      "review_case_1",
      "ops_3",
      "compliance_lead",
      {
        decision: "approved",
        note: "Release approved."
      }
    );

    expect(result.stateReused).toBe(false);
    expect(result.accountReleaseReview.restriction.status).toBe(
      CustomerAccountRestrictionStatus.released
    );
    expect(result.accountReleaseReview.customer.status).toBe(
      AccountLifecycleStatus.active
    );
    expect(transaction.customerAccountRestriction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "restriction_1",
          status: CustomerAccountRestrictionStatus.active,
          releaseDecisionStatus:
            CustomerAccountRestrictionReleaseDecisionStatus.pending
        },
        data: expect.objectContaining({
          status: CustomerAccountRestrictionStatus.released,
          releasedByOperatorId: "ops_3",
          releasedByOperatorRole: "compliance_lead",
          restoredStatus: AccountLifecycleStatus.active,
          releaseDecisionStatus:
            CustomerAccountRestrictionReleaseDecisionStatus.approved
        })
      })
    );
    expect(transaction.customerAccount.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "account_1",
          status: AccountLifecycleStatus.restricted,
          restrictedByOversightIncidentId: "incident_1"
        },
        data: expect.objectContaining({
          status: AccountLifecycleStatus.active,
          restrictionReleasedByOperatorId: "ops_3"
        })
      })
    );
  });

  it("denies account release and keeps the hold active", async () => {
    const { service, prismaService } = createService();

    (prismaService.reviewCase.findUnique as jest.Mock).mockResolvedValue(
      buildReviewCase()
    );
    (prismaService.customerAccountRestriction.findFirst as jest.Mock).mockResolvedValue(
      buildRestriction({
        releaseDecisionStatus:
          CustomerAccountRestrictionReleaseDecisionStatus.pending,
        releaseRequestedAt: new Date("2026-04-03T00:00:00.000Z"),
        releaseRequestedByOperatorId: "ops_2"
      })
    );

    const transaction = {
      customerAccountRestriction: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(
          buildRestriction({
            releaseDecisionStatus:
              CustomerAccountRestrictionReleaseDecisionStatus.denied,
            releaseRequestedAt: new Date("2026-04-03T00:00:00.000Z"),
            releaseRequestedByOperatorId: "ops_2",
            releaseDecidedAt: new Date("2026-04-03T01:00:00.000Z"),
            releaseDecidedByOperatorId: "ops_3",
            releaseDecisionNote: "Hold remains necessary.",
            releaseReviewCase: buildReviewCase({
              status: ReviewCaseStatus.in_progress,
              startedAt: new Date("2026-04-03T01:00:00.000Z")
            })
          })
        )
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
      async (callback: (tx: any) => Promise<unknown>) => callback(transaction)
    );

    const result = await service.decideAccountRelease(
      "review_case_1",
      "ops_3",
      "compliance_lead",
      {
        decision: "denied",
        note: "Hold remains necessary."
      }
    );

    expect(result.stateReused).toBe(false);
    expect(result.accountReleaseReview.restriction.status).toBe(
      CustomerAccountRestrictionStatus.active
    );
    expect(result.accountReleaseReview.restriction.releaseDecisionStatus).toBe(
      CustomerAccountRestrictionReleaseDecisionStatus.denied
    );
    expect(result.accountReleaseReview.customer.status).toBe(
      AccountLifecycleStatus.restricted
    );
    expect(transaction.reviewCase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "review_case_1"
        },
        data: expect.objectContaining({
          status: ReviewCaseStatus.in_progress
        })
      })
    );
  });

  it("rejects account release decisions from unauthorized roles", async () => {
    const { service } = createService();

    await expect(
      service.decideAccountRelease("review_case_1", "ops_3", "junior_operator", {
        decision: "approved",
        note: "Attempted without authority."
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects approval when the release request is not pending", async () => {
    const { service, prismaService } = createService();

    (prismaService.reviewCase.findUnique as jest.Mock).mockResolvedValue(
      buildReviewCase()
    );
    (prismaService.customerAccountRestriction.findFirst as jest.Mock).mockResolvedValue(
      buildRestriction()
    );

    await expect(
      service.decideAccountRelease("review_case_1", "ops_3", "compliance_lead", {
        decision: "approved",
        note: "Attempted prematurely."
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
