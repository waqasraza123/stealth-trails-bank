jest.mock("@stealth-trails-bank/config/api", () => ({
  loadInternalOperatorRuntimeConfig: () => ({
    internalOperatorApiKey: "test-operator-key"
  })
}));

import { ExecutionContext, INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { InternalOperatorBearerGuard } from "../auth/guards/internal-operator-bearer.guard";
import { CustomerAccountOperationsController } from "./customer-account-operations.controller";
import { CustomerAccountOperationsService } from "./customer-account-operations.service";

describe("CustomerAccountOperationsController", () => {
  let app: INestApplication;
  const customerAccountOperationsService = {
    listCustomerAccountTimeline: jest.fn()
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CustomerAccountOperationsController],
      providers: [
        {
          provide: CustomerAccountOperationsService,
          useValue: customerAccountOperationsService
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

  it("rejects malformed customer timeline filters", async () => {
    await request(app.getHttpServer())
      .get("/customer-account-operations/internal/timeline")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .query({
        customerAccountId: "a".repeat(201)
      })
      .expect(400);

    expect(
      customerAccountOperationsService.listCustomerAccountTimeline
    ).not.toHaveBeenCalled();
  });

  it("passes governed customer timeline filters through", async () => {
    customerAccountOperationsService.listCustomerAccountTimeline.mockResolvedValue(
      {
        summary: {
          customer: {
            customerId: "customer_1",
            customerAccountId: "account_1",
            supabaseUserId: "supabase_1",
            email: "user@example.com",
            firstName: "Amina",
            lastName: "Raza"
          },
          accountStatus: "active",
          currentRestriction: null,
          counts: {
            totalTransactionIntents: 5,
            manuallyResolvedTransactionIntents: 1,
            openReviewCases: 1,
            openOversightIncidents: 0,
            activeAccountHolds: 0
          }
        },
        timeline: [],
        limit: 25,
        filters: {
          eventType: "review_case.note_added",
          actorId: "ops_1",
          dateFrom: null,
          dateTo: null
        }
      }
    );

    const response = await request(app.getHttpServer())
      .get("/customer-account-operations/internal/timeline")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .query({
        customerAccountId: "account_1",
        supabaseUserId: "supabase_1",
        limit: "25",
        eventType: "review_case.note_added",
        actorId: "ops_1"
      })
      .expect(200);

    expect(
      customerAccountOperationsService.listCustomerAccountTimeline
    ).toHaveBeenCalledWith({
      customerAccountId: "account_1",
      supabaseUserId: "supabase_1",
      limit: 25,
      eventType: "review_case.note_added",
      actorId: "ops_1"
    });
    expect(response.body).toEqual({
      status: "success",
      message: "Customer account operations timeline retrieved successfully.",
      data: {
        summary: {
          customer: {
            customerId: "customer_1",
            customerAccountId: "account_1",
            supabaseUserId: "supabase_1",
            email: "user@example.com",
            firstName: "Amina",
            lastName: "Raza"
          },
          accountStatus: "active",
          currentRestriction: null,
          counts: {
            totalTransactionIntents: 5,
            manuallyResolvedTransactionIntents: 1,
            openReviewCases: 1,
            openOversightIncidents: 0,
            activeAccountHolds: 0
          }
        },
        timeline: [],
        limit: 25,
        filters: {
          eventType: "review_case.note_added",
          actorId: "ops_1",
          dateFrom: null,
          dateTo: null
        }
      }
    });
  });
});
