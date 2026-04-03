import {
  AccountLifecycleStatus,
  CustomerAccountRestrictionReleaseDecisionStatus,
  CustomerAccountRestrictionStatus,
  OversightIncidentStatus,
  OversightIncidentType,
  ReviewCaseStatus
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AccountHoldReportingService } from "./account-hold-reporting.service";

function buildAccountHoldRecord(
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
      status: AccountLifecycleStatus.restricted,
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
    releaseReviewCase: {
      id: "review_case_1",
      status: ReviewCaseStatus.open,
      assignedOperatorId: null
    },
    ...overrides
  };
}

function createService() {
  const prismaService = {
    customerAccountRestriction: {
      findMany: jest.fn()
    }
  } as unknown as PrismaService;

  const service = new AccountHoldReportingService(prismaService);

  return {
    service,
    prismaService
  };
}

describe("AccountHoldReportingService", () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("lists active account holds with release review state", async () => {
    const { service, prismaService } = createService();

    (prismaService.customerAccountRestriction.findMany as jest.Mock).mockResolvedValue(
      [
        buildAccountHoldRecord({
          releaseDecisionStatus:
            CustomerAccountRestrictionReleaseDecisionStatus.pending,
          releaseRequestedAt: new Date("2026-04-03T00:00:00.000Z"),
          releaseRequestedByOperatorId: "ops_2",
          releaseRequestNote: "Escalating for approval."
        })
      ]
    );

    const result = await service.listActiveAccountHolds({
      limit: 20
    });

    expect(result.holds).toHaveLength(1);
    expect(result.holds[0].hold.status).toBe(
      CustomerAccountRestrictionStatus.active
    );
    expect(result.holds[0].releaseReview.decisionStatus).toBe(
      CustomerAccountRestrictionReleaseDecisionStatus.pending
    );
    expect(result.holds[0].releaseReview.reviewCaseId).toBe("review_case_1");
  });

  it("lists released account holds with hold duration", async () => {
    const { service, prismaService } = createService();

    (prismaService.customerAccountRestriction.findMany as jest.Mock).mockResolvedValue(
      [
        buildAccountHoldRecord({
          status: CustomerAccountRestrictionStatus.released,
          releasedAt: new Date("2026-04-03T00:00:00.000Z"),
          releasedByOperatorId: "ops_2",
          releasedByOperatorRole: "compliance_lead",
          releaseNote: "Released after investigation.",
          restoredStatus: AccountLifecycleStatus.active,
          releaseDecisionStatus:
            CustomerAccountRestrictionReleaseDecisionStatus.approved,
          releaseRequestedAt: new Date("2026-04-02T12:00:00.000Z"),
          releaseRequestedByOperatorId: "ops_3",
          releaseRequestNote: "Requesting release.",
          releaseDecidedAt: new Date("2026-04-03T00:00:00.000Z"),
          releaseDecidedByOperatorId: "ops_2",
          releaseDecisionNote: "Released after investigation.",
          customerAccount: {
            ...buildAccountHoldRecord().customerAccount,
            status: AccountLifecycleStatus.active
          },
          releaseReviewCase: {
            id: "review_case_1",
            status: ReviewCaseStatus.resolved,
            assignedOperatorId: "ops_3"
          }
        })
      ]
    );

    const result = await service.listReleasedAccountHolds({
      limit: 20,
      sinceDays: 30,
      releaseDecisionStatus: "approved"
    });

    expect(result.holds).toHaveLength(1);
    expect(result.holds[0].hold.releasedByOperatorId).toBe("ops_2");
    expect(result.holds[0].hold.status).toBe(
      CustomerAccountRestrictionStatus.released
    );
    expect(result.holds[0].hold.holdDurationMs).toBe(86400000);
    expect(result.holds[0].releaseReview.decisionStatus).toBe(
      CustomerAccountRestrictionReleaseDecisionStatus.approved
    );
  });

  it("returns account hold summary counts", async () => {
    const { service, prismaService } = createService();

    (prismaService.customerAccountRestriction.findMany as jest.Mock).mockResolvedValue(
      [
        buildAccountHoldRecord(),
        buildAccountHoldRecord({
          id: "restriction_2",
          status: CustomerAccountRestrictionStatus.released,
          releasedAt: new Date("2026-04-03T00:00:00.000Z"),
          releasedByOperatorId: "ops_2",
          releasedByOperatorRole: "compliance_lead",
          releaseDecisionStatus:
            CustomerAccountRestrictionReleaseDecisionStatus.approved,
          restoredStatus: AccountLifecycleStatus.active,
          oversightIncident: {
            ...buildAccountHoldRecord().oversightIncident,
            incidentType: OversightIncidentType.operator_manual_resolution_spike
          }
        })
      ]
    );

    const result = await service.getAccountHoldSummary({
      sinceDays: 30
    });

    expect(result.totalHolds).toBe(2);
    expect(result.activeHolds).toBe(1);
    expect(result.releasedHolds).toBe(1);
    expect(result.byIncidentType).toHaveLength(2);
    expect(result.byAppliedOperator).toHaveLength(1);
    expect(result.byReleasedOperator).toHaveLength(1);
  });
});
