jest.mock("@stealth-trails-bank/config/api", () => ({
  loadInternalOperatorRuntimeConfig: () => ({
    internalOperatorApiKey: "test-operator-key"
  })
}));

import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { InternalOperatorApiKeyGuard } from "../auth/guards/internal-operator-api-key.guard";
import { CustomerAccountIncidentPackageReleaseWorkflowController } from "./customer-account-incident-package-release-workflow.controller";
import { CustomerAccountIncidentPackageReleaseWorkflowService } from "./customer-account-incident-package-release-workflow.service";

describe("CustomerAccountIncidentPackageReleaseWorkflowController", () => {
  let app: INestApplication;
  const customerAccountIncidentPackageReleaseWorkflowService = {
    createReleaseRequest: jest.fn(),
    listPendingReleases: jest.fn(),
    listReleasedReleases: jest.fn(),
    getRelease: jest.fn(),
    approveRelease: jest.fn(),
    rejectRelease: jest.fn(),
    releaseApprovedPackage: jest.fn()
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CustomerAccountIncidentPackageReleaseWorkflowController],
      providers: [
        InternalOperatorApiKeyGuard,
        {
          provide: CustomerAccountIncidentPackageReleaseWorkflowService,
          useValue: customerAccountIncidentPackageReleaseWorkflowService
        }
      ]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects malformed incident package release requests", async () => {
    await request(app.getHttpServer())
      .post("/customer-account-incident-package/internal/releases")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .send({
        customerAccountId: "account_1",
        releaseTarget: "compliance_handoff",
        releaseReasonCode: "Invalid-Reason",
        requestNote: "   "
      })
      .expect(400);

    expect(
      customerAccountIncidentPackageReleaseWorkflowService.createReleaseRequest
    ).not.toHaveBeenCalled();
  });

  it("passes governed release creation inputs through", async () => {
    customerAccountIncidentPackageReleaseWorkflowService.createReleaseRequest.mockResolvedValue(
      {
        release: {
          id: "release_1"
        }
      }
    );

    const response = await request(app.getHttpServer())
      .post("/customer-account-incident-package/internal/releases")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .set("x-operator-role", "operations_admin")
      .send({
        customerAccountId: "account_1",
        supabaseUserId: "supabase_1",
        mode: "compliance_focused",
        releaseTarget: "compliance_handoff",
        releaseReasonCode: "compliance_review_request",
        requestNote: "Need a governed package export.",
        recentLimit: 25,
        timelineLimit: 100,
        sinceDays: 30
      })
      .expect(201);

    expect(
      customerAccountIncidentPackageReleaseWorkflowService.createReleaseRequest
    ).toHaveBeenCalledWith(
      {
        customerAccountId: "account_1",
        supabaseUserId: "supabase_1",
        mode: "compliance_focused",
        releaseTarget: "compliance_handoff",
        releaseReasonCode: "compliance_review_request",
        requestNote: "Need a governed package export.",
        recentLimit: 25,
        timelineLimit: 100,
        sinceDays: 30
      },
      "ops_1",
      "operations_admin"
    );
    expect(response.body).toEqual({
      status: "success",
      message: "Incident package release request created successfully.",
      data: {
        release: {
          id: "release_1"
        }
      }
    });
  });

  it("rejects malformed pending release filters", async () => {
    await request(app.getHttpServer())
      .get("/customer-account-incident-package/internal/releases/pending")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .query({
        customerAccountId: "a".repeat(201),
        limit: "101"
      })
      .expect(400);

    expect(
      customerAccountIncidentPackageReleaseWorkflowService.listPendingReleases
    ).not.toHaveBeenCalled();
  });

  it("passes governed pending release filters through", async () => {
    customerAccountIncidentPackageReleaseWorkflowService.listPendingReleases.mockResolvedValue(
      {
        releases: [],
        limit: 20
      }
    );

    const response = await request(app.getHttpServer())
      .get("/customer-account-incident-package/internal/releases/pending")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .query({
        customerAccountId: "account_1",
        requestedByOperatorId: "ops_requester",
        mode: "compliance_focused",
        releaseTarget: "compliance_handoff",
        limit: "20"
      })
      .expect(200);

    expect(
      customerAccountIncidentPackageReleaseWorkflowService.listPendingReleases
    ).toHaveBeenCalledWith({
      customerAccountId: "account_1",
      requestedByOperatorId: "ops_requester",
      mode: "compliance_focused",
      releaseTarget: "compliance_handoff",
      limit: 20
    });
    expect(response.body).toEqual({
      status: "success",
      message:
        "Pending incident package release requests retrieved successfully.",
      data: {
        releases: [],
        limit: 20
      }
    });
  });

  it("rejects malformed released release filters", async () => {
    await request(app.getHttpServer())
      .get("/customer-account-incident-package/internal/releases/released")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .query({
        releasedByOperatorId: "a".repeat(201),
        sinceDays: "366"
      })
      .expect(400);

    expect(
      customerAccountIncidentPackageReleaseWorkflowService.listReleasedReleases
    ).not.toHaveBeenCalled();
  });

  it("passes governed released release filters through", async () => {
    customerAccountIncidentPackageReleaseWorkflowService.listReleasedReleases.mockResolvedValue(
      {
        releases: [],
        limit: 10
      }
    );

    const response = await request(app.getHttpServer())
      .get("/customer-account-incident-package/internal/releases/released")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .query({
        customerAccountId: "account_1",
        releasedByOperatorId: "ops_releaser",
        mode: "internal_full",
        releaseTarget: "internal_casefile",
        sinceDays: "30",
        limit: "10"
      })
      .expect(200);

    expect(
      customerAccountIncidentPackageReleaseWorkflowService.listReleasedReleases
    ).toHaveBeenCalledWith({
      customerAccountId: "account_1",
      releasedByOperatorId: "ops_releaser",
      mode: "internal_full",
      releaseTarget: "internal_casefile",
      sinceDays: 30,
      limit: 10
    });
    expect(response.body).toEqual({
      status: "success",
      message: "Released incident package records retrieved successfully.",
      data: {
        releases: [],
        limit: 10
      }
    });
  });

  it("rejects malformed approval notes", async () => {
    await request(app.getHttpServer())
      .post("/customer-account-incident-package/internal/releases/release_1/approve")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_2")
      .send({
        approvalNote: " ".repeat(3)
      })
      .expect(400);

    expect(
      customerAccountIncidentPackageReleaseWorkflowService.approveRelease
    ).not.toHaveBeenCalled();
  });

  it("passes governed approval inputs through", async () => {
    customerAccountIncidentPackageReleaseWorkflowService.approveRelease.mockResolvedValue(
      {
        release: {
          id: "release_1"
        },
        stateReused: false
      }
    );

    const response = await request(app.getHttpServer())
      .post("/customer-account-incident-package/internal/releases/release_1/approve")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_2")
      .set("x-operator-role", "compliance_lead")
      .send({
        approvalNote: "Approved for controlled release."
      })
      .expect(201);

    expect(
      customerAccountIncidentPackageReleaseWorkflowService.approveRelease
    ).toHaveBeenCalledWith(
      "release_1",
      "ops_2",
      "compliance_lead",
      {
        approvalNote: "Approved for controlled release."
      }
    );
    expect(response.body).toEqual({
      status: "success",
      message: "Incident package release approved successfully.",
      data: {
        release: {
          id: "release_1"
        },
        stateReused: false
      }
    });
  });
});
