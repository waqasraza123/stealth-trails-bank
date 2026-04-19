jest.mock("@stealth-trails-bank/config/api", () => ({
  loadInternalOperatorRuntimeConfig: () => ({
    internalOperatorApiKey: "test-operator-key"
  })
}));

import { ExecutionContext, INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { InternalOperatorBearerGuard } from "../auth/guards/internal-operator-bearer.guard";
import { ManualResolutionReportingController } from "./manual-resolution-reporting.controller";
import { ManualResolutionReportingService } from "./manual-resolution-reporting.service";

describe("ManualResolutionReportingController", () => {
  let app: INestApplication;
  const manualResolutionReportingService = {
    listManuallyResolvedIntents: jest.fn(),
    listManuallyResolvedReviewCases: jest.fn(),
    getManualResolutionSummary: jest.fn()
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ManualResolutionReportingController],
      providers: [
        {
          provide: ManualResolutionReportingService,
          useValue: manualResolutionReportingService
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

  it("rejects malformed manual resolution reporting filters", async () => {
    await request(app.getHttpServer())
      .get("/review-cases/internal/manual-resolutions/intents")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .query({
        customerAccountId: "a".repeat(201),
        manualResolutionReasonCode: "Support Case Closed",
        email: "not-an-email"
      })
      .expect(400);

    expect(
      manualResolutionReportingService.listManuallyResolvedIntents
    ).not.toHaveBeenCalled();
  });

  it("passes governed manual resolution reporting filters through", async () => {
    manualResolutionReportingService.getManualResolutionSummary.mockResolvedValue(
      {
        totalIntents: 1,
        byIntentType: [],
        byReasonCode: [],
        byOperator: []
      }
    );

    const response = await request(app.getHttpServer())
      .get("/review-cases/internal/manual-resolutions/summary")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .query({
        sinceDays: "30",
        intentType: "withdrawal",
        manualResolutionReasonCode: "support_case_closed",
        manualResolvedByOperatorId: "ops_1"
      })
      .expect(200);

    expect(
      manualResolutionReportingService.getManualResolutionSummary
    ).toHaveBeenCalledWith({
      sinceDays: 30,
      intentType: "withdrawal",
      manualResolutionReasonCode: "support_case_closed",
      manualResolvedByOperatorId: "ops_1"
    });
    expect(response.body).toEqual({
      status: "success",
      message: "Manual resolution summary retrieved successfully.",
      data: {
        totalIntents: 1,
        byIntentType: [],
        byReasonCode: [],
        byOperator: []
      }
    });
  });
});
