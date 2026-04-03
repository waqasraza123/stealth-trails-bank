import { ConflictException, ForbiddenException } from "@nestjs/common";
import {
  AccountLifecycleStatus,
  CustomerAccountRestrictionStatus,
  OversightIncidentStatus,
  OversightIncidentType
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { OversightIncidentsService } from "./oversight-incidents.service";

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

function buildCustomerAccount(
  overrides: Partial<Record<string, unknown>> = {}
) {
  return {
    id: "account_1",
    customerId: "customer_1",
    status: AccountLifecycleStatus.active,
    restrictedAt: null,
    restrictedFromStatus: null,
    restrictionReasonCode: null,
    restrictedByOperatorId: null,
    restrictedByOversightIncidentId: null,
    restrictionReleasedAt: null,
    restrictionReleasedByOperatorId: null,
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
    customerAccount: {
      findUnique: jest.fn(),
      update: jest.fn()
    },
    customerAccountRestriction: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    },
    auditEvent: {
      create: jest.fn()
    },
    $transaction: jest.fn()
  } as unknown as PrismaService;

  const service = new OversightIncidentsService(prismaService);

  return {
    service,
    prismaService
  };
}

describe("OversightIncidentsService account restriction workflow", () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("places an account restriction from an oversight incident", async () => {
    const { service, prismaService } = createService();

    (prismaService.oversightIncident.findUnique as jest.Mock).mockResolvedValue(
      buildOversightIncident()
    );

    (prismaService.customerAccount.findUnique as jest.Mock).mockResolvedValue(
      buildCustomerAccount()
    );

    const transaction = {
      customerAccount: {
        update: jest.fn().mockResolvedValue(
          buildCustomerAccount({
            status: AccountLifecycleStatus.restricted,
            restrictedAt: new Date("2026-04-01T01:10:00.000Z"),
            restrictedFromStatus: AccountLifecycleStatus.active,
            restrictionReasonCode: "oversight_risk_hold",
            restrictedByOperatorId: "ops_1",
            restrictedByOversightIncidentId: "incident_1",
            restrictionReleasedAt: null,
            restrictionReleasedByOperatorId: null
          })
        )
      },
      customerAccountRestriction: {
        create: jest.fn().mockResolvedValue({
          id: "restriction_1"
        })
      },
      oversightIncident: {
        update: jest.fn().mockResolvedValue(
          buildOversightIncident({
            status: OversightIncidentStatus.in_progress,
            assignedOperatorId: "ops_1",
            startedAt: new Date("2026-04-01T01:10:00.000Z")
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

    const result = await service.applyAccountRestriction(
      "incident_1",
      "ops_1",
      "risk_manager",
      {
        restrictionReasonCode: "oversight_risk_hold",
        note: "Placing a temporary risk hold."
      }
    );

    expect(result.stateReused).toBe(false);
    expect(result.accountRestriction.active).toBe(true);
    expect(result.accountRestriction.accountStatus).toBe(
      AccountLifecycleStatus.restricted
    );
    expect(transaction.customerAccountRestriction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: CustomerAccountRestrictionStatus.active,
          appliedByOperatorId: "ops_1",
          appliedByOperatorRole: "risk_manager",
          restrictionReasonCode: "oversight_risk_hold"
        })
      })
    );
  });

  it("reuses account restriction placement when the same incident already holds the account", async () => {
    const { service, prismaService } = createService();

    (prismaService.oversightIncident.findUnique as jest.Mock).mockResolvedValue(
      buildOversightIncident({
        subjectCustomerAccount: buildCustomerAccount({
          status: AccountLifecycleStatus.restricted,
          restrictedAt: new Date("2026-04-01T01:10:00.000Z"),
          restrictedFromStatus: AccountLifecycleStatus.active,
          restrictionReasonCode: "oversight_risk_hold",
          restrictedByOperatorId: "ops_1",
          restrictedByOversightIncidentId: "incident_1",
          restrictionReleasedAt: null,
          restrictionReleasedByOperatorId: null
        })
      })
    );

    (prismaService.customerAccount.findUnique as jest.Mock).mockResolvedValue(
      buildCustomerAccount({
        status: AccountLifecycleStatus.restricted,
        restrictedAt: new Date("2026-04-01T01:10:00.000Z"),
        restrictedFromStatus: AccountLifecycleStatus.active,
        restrictionReasonCode: "oversight_risk_hold",
        restrictedByOperatorId: "ops_1",
        restrictedByOversightIncidentId: "incident_1",
        restrictionReleasedAt: null,
        restrictionReleasedByOperatorId: null
      })
    );

    const result = await service.applyAccountRestriction(
      "incident_1",
      "ops_1",
      "risk_manager",
      {
        restrictionReasonCode: "oversight_risk_hold"
      }
    );

    expect(result.stateReused).toBe(true);
    expect(result.accountRestriction.active).toBe(true);
  });

  it("releases an account restriction back to its previous status", async () => {
    const { service, prismaService } = createService();

    (prismaService.oversightIncident.findUnique as jest.Mock).mockResolvedValue(
      buildOversightIncident({
        status: OversightIncidentStatus.in_progress,
        assignedOperatorId: "ops_1",
        subjectCustomerAccount: buildCustomerAccount({
          status: AccountLifecycleStatus.restricted,
          restrictedAt: new Date("2026-04-01T01:10:00.000Z"),
          restrictedFromStatus: AccountLifecycleStatus.active,
          restrictionReasonCode: "oversight_risk_hold",
          restrictedByOperatorId: "ops_1",
          restrictedByOversightIncidentId: "incident_1",
          restrictionReleasedAt: null,
          restrictionReleasedByOperatorId: null
        })
      })
    );

    (prismaService.customerAccount.findUnique as jest.Mock).mockResolvedValue(
      buildCustomerAccount({
        status: AccountLifecycleStatus.restricted,
        restrictedAt: new Date("2026-04-01T01:10:00.000Z"),
        restrictedFromStatus: AccountLifecycleStatus.active,
        restrictionReasonCode: "oversight_risk_hold",
        restrictedByOperatorId: "ops_1",
        restrictedByOversightIncidentId: "incident_1",
        restrictionReleasedAt: null,
        restrictionReleasedByOperatorId: null
      })
    );

    (prismaService.customerAccountRestriction.findFirst as jest.Mock).mockResolvedValue(
      {
        id: "restriction_1"
      }
    );

    const transaction = {
      customerAccount: {
        update: jest.fn().mockResolvedValue(
          buildCustomerAccount({
            status: AccountLifecycleStatus.active,
            restrictedAt: new Date("2026-04-01T01:10:00.000Z"),
            restrictedFromStatus: AccountLifecycleStatus.active,
            restrictionReasonCode: "oversight_risk_hold",
            restrictedByOperatorId: "ops_1",
            restrictedByOversightIncidentId: "incident_1",
            restrictionReleasedAt: new Date("2026-04-01T01:20:00.000Z"),
            restrictionReleasedByOperatorId: "ops_1"
          })
        )
      },
      customerAccountRestriction: {
        findFirst: jest.fn().mockResolvedValue({
          id: "restriction_1"
        }),
        updateMany: jest.fn().mockResolvedValue({
          count: 1
        })
      },
      oversightIncident: {
        update: jest.fn().mockResolvedValue(
          buildOversightIncident({
            status: OversightIncidentStatus.in_progress,
            assignedOperatorId: "ops_1",
            startedAt: new Date("2026-04-01T01:10:00.000Z")
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

    const result = await service.releaseAccountRestriction(
      "incident_1",
      "ops_1",
      "compliance_lead",
      {
        note: "Releasing hold after investigation."
      }
    );

    expect(result.stateReused).toBe(false);
    expect(result.accountRestriction.active).toBe(false);
    expect(result.accountRestriction.accountStatus).toBe(
      AccountLifecycleStatus.active
    );
    expect(transaction.customerAccountRestriction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "restriction_1",
          status: CustomerAccountRestrictionStatus.active
        },
        data: expect.objectContaining({
          status: CustomerAccountRestrictionStatus.released,
          releasedByOperatorId: "ops_1",
          releasedByOperatorRole: "compliance_lead",
          restoredStatus: AccountLifecycleStatus.active
        })
      })
    );
  });

  it("rejects restriction placement when the account is already restricted by another hold", async () => {
    const { service, prismaService } = createService();

    (prismaService.oversightIncident.findUnique as jest.Mock).mockResolvedValue(
      buildOversightIncident()
    );

    (prismaService.customerAccount.findUnique as jest.Mock).mockResolvedValue(
      buildCustomerAccount({
        status: AccountLifecycleStatus.restricted,
        restrictedByOversightIncidentId: "incident_2",
        restrictionReleasedAt: null
      })
    );

    await expect(
      service.applyAccountRestriction(
        "incident_1",
        "ops_1",
        "risk_manager",
        {
          restrictionReasonCode: "oversight_risk_hold"
        }
      )
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects account hold placement when the operator role is not authorized", async () => {
    const { service, prismaService } = createService();

    (prismaService.oversightIncident.findUnique as jest.Mock).mockResolvedValue(
      buildOversightIncident()
    );

    await expect(
      service.applyAccountRestriction(
        "incident_1",
        "ops_1",
        "junior_operator",
        {
          restrictionReasonCode: "oversight_risk_hold"
        }
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects account hold release when the operator role is not authorized", async () => {
    const { service, prismaService } = createService();

    (prismaService.oversightIncident.findUnique as jest.Mock).mockResolvedValue(
      buildOversightIncident({
        status: OversightIncidentStatus.in_progress,
        subjectCustomerAccount: buildCustomerAccount({
          status: AccountLifecycleStatus.restricted,
          restrictedAt: new Date("2026-04-01T01:10:00.000Z"),
          restrictedFromStatus: AccountLifecycleStatus.active,
          restrictionReasonCode: "oversight_risk_hold",
          restrictedByOperatorId: "ops_1",
          restrictedByOversightIncidentId: "incident_1",
          restrictionReleasedAt: null,
          restrictionReleasedByOperatorId: null
        })
      })
    );

    await expect(
      service.releaseAccountRestriction(
        "incident_1",
        "ops_1",
        "junior_operator",
        {
          note: "Attempting release without authority."
        }
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
