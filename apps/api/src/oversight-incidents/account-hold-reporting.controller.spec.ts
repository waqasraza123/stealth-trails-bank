jest.mock("@stealth-trails-bank/config/api", () => ({
  loadInternalOperatorRuntimeConfig: () => ({
    internalOperatorApiKey: "test-operator-key"
  })
}));

import { ExecutionContext, INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { InternalOperatorBearerGuard } from "../auth/guards/internal-operator-bearer.guard";
import { AccountHoldReportingController } from "./account-hold-reporting.controller";
import { AccountHoldReportingService } from "./account-hold-reporting.service";

describe("AccountHoldReportingController", () => {
  let app: INestApplication;
  const accountHoldReportingService = {
    listActiveAccountHolds: jest.fn(),
    listReleasedAccountHolds: jest.fn(),
    getAccountHoldSummary: jest.fn()
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AccountHoldReportingController],
      providers: [
        {
          provide: AccountHoldReportingService,
          useValue: accountHoldReportingService
        }
      ]
    })
      .overrideGuard(InternalOperatorBearerGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const request = context.switchToHttp().getRequest();
          request.internalOperator = {
            operatorId:
              typeof request.headers["x-operator-id"] === "string"
                ? request.headers["x-operator-id"]
                : "ops_1",
            operatorRole:
              typeof request.headers["x-operator-role"] === "string"
                ? request.headers["x-operator-role"]
                : null
          };

          return true;
        }
      })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects malformed account hold reporting filters", async () => {
    await request(app.getHttpServer())
      .get("/oversight-incidents/internal/account-holds/active")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .query({
        restrictionReasonCode: "Risk Hold",
        appliedByOperatorId: "a".repeat(201),
        email: "invalid-email"
      })
      .expect(400);

    expect(
      accountHoldReportingService.listActiveAccountHolds
    ).not.toHaveBeenCalled();
  });

  it("passes governed account hold summary filters through", async () => {
    accountHoldReportingService.getAccountHoldSummary.mockResolvedValue({
      totalHolds: 1,
      activeHolds: 1,
      releasedHolds: 0,
      byIncidentType: [],
      byReasonCode: [],
      byAppliedOperator: [],
      byReleasedOperator: []
    });

    const response = await request(app.getHttpServer())
      .get("/oversight-incidents/internal/account-holds/summary")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .query({
        sinceDays: "30",
        incidentType: "customer_manual_resolution_spike",
        restrictionReasonCode: "oversight_risk_hold",
        appliedByOperatorId: "ops_1",
        releasedByOperatorId: "ops_2",
        releaseDecisionStatus: "approved"
      })
      .expect(200);

    expect(accountHoldReportingService.getAccountHoldSummary).toHaveBeenCalledWith(
      {
        sinceDays: 30,
        incidentType: "customer_manual_resolution_spike",
        restrictionReasonCode: "oversight_risk_hold",
        appliedByOperatorId: "ops_1",
        releasedByOperatorId: "ops_2",
        releaseDecisionStatus: "approved"
      }
    );
    expect(response.body).toEqual({
      status: "success",
      message: "Account hold summary retrieved successfully.",
      data: {
        totalHolds: 1,
        activeHolds: 1,
        releasedHolds: 0,
        byIncidentType: [],
        byReasonCode: [],
        byAppliedOperator: [],
        byReleasedOperator: []
      }
    });
  });
});
