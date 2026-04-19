jest.mock("@stealth-trails-bank/config/api", () => ({
  loadInternalOperatorRuntimeConfig: () => ({
    internalOperatorApiKey: "test-operator-key"
  })
}));

import { ExecutionContext, INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { InternalOperatorBearerGuard } from "../auth/guards/internal-operator-bearer.guard";
import { AccountRestrictionReleaseReviewController } from "./account-restriction-release-review.controller";
import { AccountRestrictionReleaseReviewService } from "./account-restriction-release-review.service";

describe("AccountRestrictionReleaseReviewController", () => {
  let app: INestApplication;
  const accountRestrictionReleaseReviewService = {
    listPendingAccountReleaseReviews: jest.fn()
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AccountRestrictionReleaseReviewController],
      providers: [
        {
          provide: AccountRestrictionReleaseReviewService,
          useValue: accountRestrictionReleaseReviewService
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

  it("rejects malformed pending account release review filters", async () => {
    await request(app.getHttpServer())
      .get("/review-cases/internal/account-release-requests/pending")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .query({
        restrictionReasonCode: "Risk Hold",
        requestedByOperatorId: "a".repeat(201),
        email: "invalid-email"
      })
      .expect(400);

    expect(
      accountRestrictionReleaseReviewService.listPendingAccountReleaseReviews
    ).not.toHaveBeenCalled();
  });

  it("passes governed pending account release review filters through", async () => {
    accountRestrictionReleaseReviewService.listPendingAccountReleaseReviews.mockResolvedValue(
      {
        reviewCases: [],
        limit: 25
      }
    );

    const response = await request(app.getHttpServer())
      .get("/review-cases/internal/account-release-requests/pending")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .query({
        limit: "25",
        incidentType: "customer_manual_resolution_spike",
        restrictionReasonCode: "oversight_risk_hold",
        requestedByOperatorId: "ops_2",
        assignedOperatorId: "ops_1",
        email: "user@example.com"
      })
      .expect(200);

    expect(
      accountRestrictionReleaseReviewService.listPendingAccountReleaseReviews
    ).toHaveBeenCalledWith({
      limit: 25,
      incidentType: "customer_manual_resolution_spike",
      restrictionReasonCode: "oversight_risk_hold",
      requestedByOperatorId: "ops_2",
      assignedOperatorId: "ops_1",
      email: "user@example.com"
    });
    expect(response.body).toEqual({
      status: "success",
      message: "Pending account release reviews retrieved successfully.",
      data: {
        reviewCases: [],
        limit: 25
      }
    });
  });
});
