import {
  AccountLifecycleStatus,
  CustomerAccountRestrictionStatus,
  OversightIncidentStatus,
  OversightIncidentType
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

  it("lists active account holds", async () => {
    const { service, prismaService } = createService();

    (prismaService.customerAccountRestriction.findMany as jest.Mock).mockResolvedValue(
      [buildAccountHoldRecord()]
    );

    const result = await service.listActiveAccountHolds({
      limit: 20
    });

    expect(result.holds).toHaveLength(1);
    expect(result.holds[0].hold.status).toBe(
      CustomerAccountRestrictionStatus.active
    );
    expect(result.holds[0].hold.appliedByOperatorId).toBe("ops_1");
  });

  it("lists released account holds", async () => {
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
          customerAccount: {
            ...buildAccountHoldRecord().customerAccount,
            status: AccountLifecycleStatus.active,
            restrictionReleasedAt: new Date("2026-04-03T00:00:00.000Z"),
            restrictionReleasedByOperatorId: "ops_2"
          }
        })
      ]
    );

    const result = await service.listReleasedAccountHolds({
      limit: 20,
      sinceDays: 30
    });

    expect(result.holds).toHaveLength(1);
    expect(result.holds[0].hold.releasedByOperatorId).toBe("ops_2");
    expect(result.holds[0].hold.status).toBe(
      CustomerAccountRestrictionStatus.released
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
