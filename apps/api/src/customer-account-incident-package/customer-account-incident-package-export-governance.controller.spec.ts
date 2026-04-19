jest.mock("@stealth-trails-bank/config/api", () => ({
  loadInternalOperatorRuntimeConfig: () => ({
    internalOperatorApiKey: "test-operator-key"
  })
}));

import { ExecutionContext, INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { InternalOperatorBearerGuard } from "../auth/guards/internal-operator-bearer.guard";
import { CustomerAccountIncidentPackageExportGovernanceController } from "./customer-account-incident-package-export-governance.controller";
import { CustomerAccountIncidentPackageExportGovernanceService } from "./customer-account-incident-package-export-governance.service";

describe("CustomerAccountIncidentPackageExportGovernanceController", () => {
  let app: INestApplication;
  const customerAccountIncidentPackageExportGovernanceService = {
    getGovernedIncidentPackageExport: jest.fn(),
    getGovernedIncidentPackageExportMarkdown: jest.fn()
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CustomerAccountIncidentPackageExportGovernanceController],
      providers: [
        {
          provide: CustomerAccountIncidentPackageExportGovernanceService,
          useValue: customerAccountIncidentPackageExportGovernanceService
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

  it("rejects malformed governed export query filters", async () => {
    await request(app.getHttpServer())
      .get("/customer-account-incident-package/internal/export")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .query({
        customerAccountId: "a".repeat(201),
        sinceDays: "91"
      })
      .expect(400);

    expect(
      customerAccountIncidentPackageExportGovernanceService.getGovernedIncidentPackageExport
    ).not.toHaveBeenCalled();
  });

  it("passes governed export query filters through", async () => {
    customerAccountIncidentPackageExportGovernanceService.getGovernedIncidentPackageExport.mockResolvedValue(
      {
        exportMetadata: {
          exportMode: "compliance_focused"
        }
      }
    );

    const response = await request(app.getHttpServer())
      .get("/customer-account-incident-package/internal/export")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .set("x-operator-role", "compliance_lead")
      .query({
        customerAccountId: "account_1",
        supabaseUserId: "supabase_1",
        mode: "compliance_focused",
        recentLimit: "30",
        timelineLimit: "120",
        sinceDays: "30"
      })
      .expect(200);

    expect(
      customerAccountIncidentPackageExportGovernanceService.getGovernedIncidentPackageExport
    ).toHaveBeenCalledWith(
      {
        customerAccountId: "account_1",
        supabaseUserId: "supabase_1",
        mode: "compliance_focused",
        recentLimit: 30,
        timelineLimit: 120,
        sinceDays: 30
      },
      "ops_1",
      "compliance_lead"
    );
    expect(response.body).toEqual({
      status: "success",
      message:
        "Governed customer account incident package export generated successfully.",
      data: {
        exportMetadata: {
          exportMode: "compliance_focused"
        }
      }
    });
  });

  it("passes governed markdown export query filters through", async () => {
    customerAccountIncidentPackageExportGovernanceService.getGovernedIncidentPackageExportMarkdown.mockResolvedValue(
      {
        markdown: "# Governed Incident Package"
      }
    );

    const response = await request(app.getHttpServer())
      .get("/customer-account-incident-package/internal/export/markdown")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .set("x-operator-role", "compliance_lead")
      .query({
        customerAccountId: "account_1",
        recentLimit: "20",
        timelineLimit: "100"
      })
      .expect(200);

    expect(
      customerAccountIncidentPackageExportGovernanceService.getGovernedIncidentPackageExportMarkdown
    ).toHaveBeenCalledWith(
      {
        customerAccountId: "account_1",
        recentLimit: 20,
        timelineLimit: 100
      },
      "ops_1",
      "compliance_lead"
    );
    expect(response.body).toEqual({
      status: "success",
      message:
        "Governed customer account incident package markdown export generated successfully.",
      data: {
        markdown: "# Governed Incident Package"
      }
    });
  });
});
