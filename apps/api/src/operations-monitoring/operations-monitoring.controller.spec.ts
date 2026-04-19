jest.mock("@stealth-trails-bank/config/api", () => ({
  loadInternalOperatorRuntimeConfig: () => ({
    internalOperatorApiKey: "test-operator-key"
  })
}));

import { ExecutionContext, INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { InternalOperatorBearerGuard } from "../auth/guards/internal-operator-bearer.guard";
import { ApiRequestMetricsService } from "../logging/api-request-metrics.service";
import { OperationsMonitoringController } from "./operations-monitoring.controller";
import { OperationsMonitoringService } from "./operations-monitoring.service";

describe("OperationsMonitoringController", () => {
  let app: INestApplication;
  const operationsMonitoringService = {
    listPlatformAlerts: jest.fn(),
    listWorkerRuntimeHealth: jest.fn()
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [OperationsMonitoringController],
      providers: [
        {
          provide: OperationsMonitoringService,
          useValue: operationsMonitoringService
        },
        {
          provide: ApiRequestMetricsService,
          useValue: {
            recordRequestMetrics: jest.fn()
          }
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

  it("rejects malformed platform alert filters", async () => {
    await request(app.getHttpServer())
      .get("/operations/internal/alerts")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .query({
        ownerOperatorId: "a".repeat(201)
      })
      .expect(400);

    expect(operationsMonitoringService.listPlatformAlerts).not.toHaveBeenCalled();
  });

  it("rejects malformed worker health filters", async () => {
    await request(app.getHttpServer())
      .get("/operations/internal/workers/health")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .query({
        workerId: "a".repeat(201)
      })
      .expect(400);

    expect(
      operationsMonitoringService.listWorkerRuntimeHealth
    ).not.toHaveBeenCalled();
  });

  it("passes governed platform alert filters through", async () => {
    operationsMonitoringService.listPlatformAlerts.mockResolvedValue({
      alerts: [],
      limit: 25,
      staleAfterSeconds: 300,
      totalCount: 0
    });

    const response = await request(app.getHttpServer())
      .get("/operations/internal/alerts")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .query({
        limit: "25",
        staleAfterSeconds: "300",
        status: "open",
        severity: "critical",
        category: "worker",
        routingStatus: "unrouted",
        ownerOperatorId: "ops_9",
        acknowledged: "false",
        suppressed: "false"
      })
      .expect(200);

    expect(operationsMonitoringService.listPlatformAlerts).toHaveBeenCalledWith({
      limit: 25,
      staleAfterSeconds: 300,
      status: "open",
      severity: "critical",
      category: "worker",
      routingStatus: "unrouted",
      ownerOperatorId: "ops_9",
      acknowledged: "false",
      suppressed: "false"
    });
    expect(response.body).toEqual({
      status: "success",
      message: "Platform alerts retrieved successfully.",
      data: {
        alerts: [],
        limit: 25,
        staleAfterSeconds: 300,
        totalCount: 0
      }
    });
  });
});
