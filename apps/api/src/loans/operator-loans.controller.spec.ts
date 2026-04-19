jest.mock("@stealth-trails-bank/config/api", () => ({
  loadInternalOperatorRuntimeConfig: () => ({
    internalOperatorApiKey: "test-operator-key"
  })
}));

import { ExecutionContext, INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { InternalOperatorBearerGuard } from "../auth/guards/internal-operator-bearer.guard";
import { LoansService } from "./loans.service";
import { OperatorLoansController } from "./operator-loans.controller";

describe("OperatorLoansController", () => {
  let app: INestApplication;
  const loansService = {
    getOperatorSummary: jest.fn(),
    listOperatorApplications: jest.fn(),
    getOperatorApplicationWorkspace: jest.fn(),
    requestMoreEvidence: jest.fn(),
    approveApplication: jest.fn(),
    rejectApplication: jest.fn(),
    placeAccountRestriction: jest.fn(),
    listOperatorAgreements: jest.fn(),
    getOperatorAgreementWorkspace: jest.fn(),
    startLiquidationReview: jest.fn(),
    approveLiquidation: jest.fn(),
    rejectLiquidation: jest.fn(),
    closeAgreement: jest.fn()
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [OperatorLoansController],
      providers: [
        {
          provide: LoansService,
          useValue: loansService
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

  it("rejects malformed loan application list filters", async () => {
    await request(app.getHttpServer())
      .get("/loans/internal/applications")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .query({
        search: "a".repeat(201)
      })
      .expect(400);

    expect(loansService.listOperatorApplications).not.toHaveBeenCalled();
  });

  it("passes governed loan application filters through", async () => {
    loansService.listOperatorApplications.mockResolvedValue({
      applications: [],
      limit: 20
    });

    const response = await request(app.getHttpServer())
      .get("/loans/internal/applications")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .query({
        limit: "20",
        status: "under_review",
        search: "jane@example.com"
      })
      .expect(200);

    expect(loansService.listOperatorApplications).toHaveBeenCalledWith({
      limit: 20,
      status: "under_review",
      search: "jane@example.com"
    });
    expect(response.body).toEqual({
      status: "success",
      message: "Loan applications retrieved successfully.",
      data: {
        applications: [],
        limit: 20
      }
    });
  });

  it("rejects malformed operator loan actions", async () => {
    await request(app.getHttpServer())
      .post("/loans/internal/applications/application_1/reject")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .send({
        note: "   ",
        reasonCode: "Invalid-Reason"
      })
      .expect(400);

    expect(loansService.rejectApplication).not.toHaveBeenCalled();
  });

  it("passes governed operator loan actions through", async () => {
    loansService.rejectApplication.mockResolvedValue({
      application: {
        id: "application_1"
      }
    });

    const response = await request(app.getHttpServer())
      .post("/loans/internal/applications/application_1/reject")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .set("x-operator-role", "risk_manager")
      .send({
        note: "Borrower did not satisfy underwriting controls.",
        reasonCode: "underwriting_rejection",
        policyOverride: true
      })
      .expect(201);

    expect(loansService.rejectApplication).toHaveBeenCalledWith(
      "application_1",
      "ops_1",
      "risk_manager",
      {
        note: "Borrower did not satisfy underwriting controls.",
        reasonCode: "underwriting_rejection",
        policyOverride: true
      }
    );
    expect(response.body).toEqual({
      status: "success",
      message: "Loan application rejected successfully.",
      data: {
        application: {
          id: "application_1"
        }
      }
    });
  });

  it("passes governed agreement filters through", async () => {
    loansService.listOperatorAgreements.mockResolvedValue({
      agreements: [],
      limit: 10
    });

    const response = await request(app.getHttpServer())
      .get("/loans/internal/agreements")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .query({
        limit: "10",
        status: "active"
      })
      .expect(200);

    expect(loansService.listOperatorAgreements).toHaveBeenCalledWith({
      limit: 10,
      status: "active"
    });
    expect(response.body).toEqual({
      status: "success",
      message: "Loan agreements retrieved successfully.",
      data: {
        agreements: [],
        limit: 10
      }
    });
  });
});
