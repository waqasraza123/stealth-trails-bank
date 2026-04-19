jest.mock("@stealth-trails-bank/config/api", () => ({
  loadInternalOperatorRuntimeConfig: () => ({
    internalOperatorApiKey: "test-operator-key"
  })
}));

import { ExecutionContext, INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { InternalOperatorBearerGuard } from "../auth/guards/internal-operator-bearer.guard";
import { CustomerAccountIncidentPackageController } from "./customer-account-incident-package.controller";
import { CustomerAccountIncidentPackageService } from "./customer-account-incident-package.service";

describe("CustomerAccountIncidentPackageController", () => {
  let app: INestApplication;
  const customerAccountIncidentPackageService = {
    buildIncidentPackage: jest.fn(),
    renderIncidentPackageMarkdown: jest.fn()
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CustomerAccountIncidentPackageController],
      providers: [
        {
          provide: CustomerAccountIncidentPackageService,
          useValue: customerAccountIncidentPackageService
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

  it("rejects malformed incident package query filters", async () => {
    await request(app.getHttpServer())
      .get("/customer-account-incident-package/internal")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .query({
        customerAccountId: "a".repeat(201),
        timelineLimit: "501"
      })
      .expect(400);

    expect(
      customerAccountIncidentPackageService.buildIncidentPackage
    ).not.toHaveBeenCalled();
  });

  it("passes governed incident package query filters through", async () => {
    customerAccountIncidentPackageService.buildIncidentPackage.mockResolvedValue({
      generatedAt: "2026-04-10T00:00:00.000Z",
      customer: {
        customerAccountId: "account_1"
      }
    });

    const response = await request(app.getHttpServer())
      .get("/customer-account-incident-package/internal")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .query({
        customerAccountId: "account_1",
        supabaseUserId: "supabase_1",
        recentLimit: "25",
        timelineLimit: "120",
        dateFrom: "2026-04-01T00:00:00.000Z",
        dateTo: "2026-04-10T00:00:00.000Z"
      })
      .expect(200);

    expect(
      customerAccountIncidentPackageService.buildIncidentPackage
    ).toHaveBeenCalledWith({
      customerAccountId: "account_1",
      supabaseUserId: "supabase_1",
      recentLimit: 25,
      timelineLimit: 120,
      dateFrom: "2026-04-01T00:00:00.000Z",
      dateTo: "2026-04-10T00:00:00.000Z"
    });
    expect(response.body).toEqual({
      status: "success",
      message: "Customer account incident package retrieved successfully.",
      data: {
        generatedAt: "2026-04-10T00:00:00.000Z",
        customer: {
          customerAccountId: "account_1"
        }
      }
    });
  });

  it("returns governed markdown exports", async () => {
    customerAccountIncidentPackageService.buildIncidentPackage.mockResolvedValue({
      generatedAt: "2026-04-10T00:00:00.000Z",
      customer: {
        customerAccountId: "account_1"
      }
    });
    customerAccountIncidentPackageService.renderIncidentPackageMarkdown.mockReturnValue(
      "# Incident Package"
    );

    const response = await request(app.getHttpServer())
      .get("/customer-account-incident-package/internal/markdown")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .query({
        customerAccountId: "account_1",
        timelineLimit: "100"
      })
      .expect(200);

    expect(
      customerAccountIncidentPackageService.renderIncidentPackageMarkdown
    ).toHaveBeenCalledWith({
      generatedAt: "2026-04-10T00:00:00.000Z",
      customer: {
        customerAccountId: "account_1"
      }
    });
    expect(response.body).toEqual({
      status: "success",
      message: "Customer account incident package markdown retrieved successfully.",
      data: {
        generatedAt: "2026-04-10T00:00:00.000Z",
        customerAccountId: "account_1",
        markdown: "# Incident Package"
      }
    });
  });
});
