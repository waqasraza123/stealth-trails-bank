jest.mock("@stealth-trails-bank/config/api", () => ({
  loadInternalOperatorRuntimeConfig: () => ({
    internalOperatorApiKey: "test-operator-key"
  })
}));

import { ExecutionContext, INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { InternalOperatorBearerGuard } from "../auth/guards/internal-operator-bearer.guard";
import { AuditEventsController } from "./audit-events.controller";
import { AuditEventsService } from "./audit-events.service";

describe("AuditEventsController", () => {
  let app: INestApplication;
  const auditEventsService = {
    listAuditEvents: jest.fn()
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuditEventsController],
      providers: [
        {
          provide: AuditEventsService,
          useValue: auditEventsService
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

  it("rejects malformed audit event filters", async () => {
    await request(app.getHttpServer())
      .get("/audit-events/internal")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .query({
        targetId: "a".repeat(201)
      })
      .expect(400);

    expect(auditEventsService.listAuditEvents).not.toHaveBeenCalled();
  });

  it("passes governed audit event filters through", async () => {
    auditEventsService.listAuditEvents.mockResolvedValue({
      events: [],
      limit: 50,
      totalCount: 0,
      filters: {
        search: "review_case",
        customerId: "customer_1",
        email: "risk@example.com",
        actorType: "operator",
        actorId: "ops_1",
        action: "review_case.",
        targetType: "ReviewCase",
        targetId: "review_1",
        dateFrom: "2026-04-01T00:00:00.000Z",
        dateTo: "2026-04-14T00:00:00.000Z"
      }
    });

    const response = await request(app.getHttpServer())
      .get("/audit-events/internal")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .query({
        limit: "50",
        search: "review_case",
        customerId: "customer_1",
        email: "risk@example.com",
        actorType: "operator",
        actorId: "ops_1",
        action: "review_case.",
        targetType: "ReviewCase",
        targetId: "review_1",
        dateFrom: "2026-04-01T00:00:00.000Z",
        dateTo: "2026-04-14T00:00:00.000Z"
      })
      .expect(200);

    expect(auditEventsService.listAuditEvents).toHaveBeenCalledWith({
      limit: 50,
      search: "review_case",
      customerId: "customer_1",
      email: "risk@example.com",
      actorType: "operator",
      actorId: "ops_1",
      action: "review_case.",
      targetType: "ReviewCase",
      targetId: "review_1",
      dateFrom: "2026-04-01T00:00:00.000Z",
      dateTo: "2026-04-14T00:00:00.000Z"
    });
    expect(response.body).toEqual({
      status: "success",
      message: "Audit events retrieved successfully.",
      data: {
        events: [],
        limit: 50,
        totalCount: 0,
        filters: {
          search: "review_case",
          customerId: "customer_1",
          email: "risk@example.com",
          actorType: "operator",
          actorId: "ops_1",
          action: "review_case.",
          targetType: "ReviewCase",
          targetId: "review_1",
          dateFrom: "2026-04-01T00:00:00.000Z",
          dateTo: "2026-04-14T00:00:00.000Z"
        }
      }
    });
  });
});
