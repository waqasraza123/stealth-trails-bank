jest.mock("@stealth-trails-bank/config/api", () => ({
  loadInternalOperatorRuntimeConfig: () => ({
    internalOperatorApiKey: "test-operator-key"
  })
}));

import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { InternalOperatorApiKeyGuard } from "../auth/guards/internal-operator-api-key.guard";
import { ReleaseReadinessController } from "./release-readiness.controller";
import { ReleaseReadinessService } from "./release-readiness.service";

function buildLaunchClosureManifest() {
  return {
    releaseIdentifier: "launch-2026.04.10.1",
    environment: "production_like",
    baseUrls: {
      web: "https://prodlike-web.example.com",
      admin: "https://prodlike-admin.example.com",
      api: "https://prodlike-api.example.com",
      restoreApi: "https://restore-api.example.com"
    },
    worker: {
      identifier: "worker-prodlike-1"
    },
    operator: {
      requesterId: "ops_requester_1",
      requesterRole: "operations_admin",
      approverId: "ops_approver_1",
      approverRole: "compliance_lead",
      apiKeyEnvironmentVariable: "INTERNAL_OPERATOR_API_KEY"
    },
    artifacts: {
      apiReleaseId: "api-2026.04.10.1",
      workerReleaseId: "worker-2026.04.10.1",
      approvalRollbackReleaseId: "launch-rollback-2026.04.09.4",
      apiRollbackReleaseId: "api-2026.04.09.4",
      workerRollbackReleaseId: "worker-2026.04.09.4",
      backupReference: "snapshot-2026-04-10T08:00Z"
    },
    alerting: {
      expectedTargetName: "ops-critical",
      expectedTargetHealthStatus: "critical",
      expectedMinReEscalations: 1,
      expectedAlertDedupeKey: "worker:degraded:worker-prodlike-1"
    },
    governance: {
      secretReviewReference: "ticket/SEC-42",
      roleReviewReference: "ticket/GOV-12",
      roleReviewRosterReference: "ticket/GOV-12#launch-roster"
    },
    notes: {
      launchSummary:
        "Production-like launch candidate ready for final governed review.",
      requestNote: "All accepted evidence must be current before approval.",
      residualRiskNote:
        "No accepted residual risks remain open at request time."
    }
  };
}

describe("ReleaseReadinessController", () => {
  let app: INestApplication;
  const releaseReadinessService = {
    getSummary: jest.fn(),
    getLaunchClosureStatus: jest.fn(),
    listLaunchClosurePacks: jest.fn(),
    getLaunchClosurePack: jest.fn(),
    storeLaunchClosurePack: jest.fn(),
    listEvidence: jest.fn(),
    getEvidence: jest.fn(),
    recordEvidence: jest.fn(),
    listApprovals: jest.fn(),
    getApproval: jest.fn(),
    getApprovalLineage: jest.fn(),
    requestApproval: jest.fn(),
    rebindApprovalToLaunchClosurePack: jest.fn(),
    approveApproval: jest.fn(),
    rejectApproval: jest.fn()
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ReleaseReadinessController],
      providers: [
        InternalOperatorApiKeyGuard,
        {
          provide: ReleaseReadinessService,
          useValue: releaseReadinessService
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
    releaseReadinessService.getLaunchClosureStatus.mockResolvedValue({
      generatedAt: "2026-04-10T12:00:00.000Z",
      releaseIdentifier: "launch-2026.04.10.1",
      environment: "production_like",
      overallStatus: "blocked",
      maximumEvidenceAgeHours: 72,
      externalChecks: [],
      latestApproval: null,
      summaryMarkdown: "Scoped launch-closure status."
    });
    releaseReadinessService.storeLaunchClosurePack.mockResolvedValue({
      validation: {
        errors: [],
        warnings: []
      },
      summaryMarkdown: "Launch-Closure Manifest Validation",
      outputSubpath: "artifacts/release-launch/launch-2026.04.10.1-production_like",
      files: [
        {
          relativePath: "README.md",
          content: "# Pack"
        }
      ],
      pack: {
        id: "pack_1",
        releaseIdentifier: "launch-2026.04.10.1",
        environment: "production_like",
        version: 1,
        generatedByOperatorId: "ops_1",
        generatedByOperatorRole: "operations_admin",
        artifactChecksumSha256: "checksum_1",
        artifactPayload: {},
        createdAt: "2026-04-10T12:00:00.000Z",
        updatedAt: "2026-04-10T12:00:00.000Z"
      }
    });
  });

  it("passes scoped release-readiness summary filters through", async () => {
    releaseReadinessService.getSummary.mockResolvedValue({
      generatedAt: "2026-04-10T12:00:00.000Z",
      releaseIdentifier: "launch-2026.04.10.1",
      environment: "production_like",
      approvalPolicy: {
        requestAllowedOperatorRoles: ["operations_admin"],
        approverAllowedOperatorRoles: ["compliance_lead"],
        maximumEvidenceAgeHours: 72,
        currentOperator: {
          operatorId: "ops_1",
          operatorRole: "operations_admin",
          canRequestApproval: true,
          canApproveOrReject: false
        }
      },
      overallStatus: "warning",
      summary: {
        requiredCheckCount: 10,
        passedCheckCount: 3,
        failedCheckCount: 0,
        pendingCheckCount: 7
      },
      requiredChecks: [],
      recentEvidence: []
    });

    const response = await request(app.getHttpServer())
      .get("/release-readiness/internal/summary")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .query({
        releaseIdentifier: "launch-2026.04.10.1",
        environment: "production_like"
      })
      .expect(200);

    expect(releaseReadinessService.getSummary).toHaveBeenCalledWith(
      {
        releaseIdentifier: "launch-2026.04.10.1",
        environment: "production_like"
      },
      {
        operatorId: "ops_1",
        operatorRole: undefined
      }
    );
    expect(response.body.data.releaseIdentifier).toBe("launch-2026.04.10.1");
  });

  it("rejects malformed release-readiness evidence filters", async () => {
    await request(app.getHttpServer())
      .get("/release-readiness/internal/evidence")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .query({
        sinceDays: "366"
      })
      .expect(400);

    expect(releaseReadinessService.listEvidence).not.toHaveBeenCalled();
  });

  it("passes governed release-readiness evidence filters through", async () => {
    releaseReadinessService.listEvidence.mockResolvedValue({
      evidence: [],
      limit: 20,
      totalCount: 0
    });

    const response = await request(app.getHttpServer())
      .get("/release-readiness/internal/evidence")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .query({
        limit: "20",
        sinceDays: "30",
        evidenceType: "backend_integration_suite",
        environment: "staging",
        status: "passed",
        releaseIdentifier: "launch-2026.04.10.1"
      })
      .expect(200);

    expect(releaseReadinessService.listEvidence).toHaveBeenCalledWith({
      limit: 20,
      sinceDays: 30,
      evidenceType: "backend_integration_suite",
      environment: "staging",
      status: "passed",
      releaseIdentifier: "launch-2026.04.10.1"
    });
    expect(response.body).toEqual({
      status: "success",
      message: "Release readiness evidence retrieved successfully.",
      data: {
        evidence: [],
        limit: 20,
        totalCount: 0
      }
    });
  });

  it("rejects malformed release-readiness evidence requests", async () => {
    await request(app.getHttpServer())
      .post("/release-readiness/internal/evidence")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .send({
        evidenceType: "backend_integration_suite",
        environment: "staging",
        status: "passed",
        summary: "   ",
        note: "   "
      })
      .expect(400);

    expect(releaseReadinessService.recordEvidence).not.toHaveBeenCalled();
  });

  it("passes governed release-readiness evidence requests through", async () => {
    releaseReadinessService.recordEvidence.mockResolvedValue({
      evidence: {
        id: "evidence_1"
      }
    });

    const response = await request(app.getHttpServer())
      .post("/release-readiness/internal/evidence")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .set("x-operator-role", "operations_admin")
      .send({
        evidenceType: "backend_integration_suite",
        environment: "staging",
        status: "passed",
        releaseIdentifier: "launch-2026.04.10.1",
        summary: "Backend integration checks passed.",
        note: "Validated the accepted staging environment.",
        runbookPath: "runbooks/release/backend-integration.md",
        evidenceLinks: [
          "https://ci.example.com/build/123",
          "https://ci.example.com/build/123"
        ]
      })
      .expect(201);

    expect(releaseReadinessService.recordEvidence).toHaveBeenCalledWith(
      {
        evidenceType: "backend_integration_suite",
        environment: "staging",
        status: "passed",
        releaseIdentifier: "launch-2026.04.10.1",
        summary: "Backend integration checks passed.",
        note: "Validated the accepted staging environment.",
        runbookPath: "runbooks/release/backend-integration.md",
        evidenceLinks: [
          "https://ci.example.com/build/123",
          "https://ci.example.com/build/123"
        ]
      },
      "ops_1",
      "operations_admin"
    );
    expect(response.body).toEqual({
      status: "success",
      message: "Release readiness evidence recorded successfully.",
      data: {
        evidence: {
          id: "evidence_1"
        }
      }
    });
  });

  it("rejects malformed release-readiness approval filters", async () => {
    await request(app.getHttpServer())
      .get("/release-readiness/internal/approvals")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .query({
        releaseIdentifier: "   "
      })
      .expect(400);

    expect(releaseReadinessService.listApprovals).not.toHaveBeenCalled();
  });

  it("passes governed release-readiness approval filters through", async () => {
    releaseReadinessService.listApprovals.mockResolvedValue({
      approvals: [],
      limit: 10,
      totalCount: 0
    });

    const response = await request(app.getHttpServer())
      .get("/release-readiness/internal/approvals")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .query({
        limit: "10",
        sinceDays: "14",
        status: "pending_approval",
        environment: "production_like",
        releaseIdentifier: "launch-2026.04.10.1"
      })
      .expect(200);

    expect(releaseReadinessService.listApprovals).toHaveBeenCalledWith({
      limit: 10,
      sinceDays: 14,
      status: "pending_approval",
      environment: "production_like",
      releaseIdentifier: "launch-2026.04.10.1"
    });
    expect(response.body).toEqual({
      status: "success",
      message: "Release readiness approvals retrieved successfully.",
      data: {
        approvals: [],
        limit: 10,
        totalCount: 0
      }
    });
  });

  it("rejects malformed launch approval requests", async () => {
    await request(app.getHttpServer())
      .post("/release-readiness/internal/approvals")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .send({
        releaseIdentifier: "launch-2026.04.10.1",
        environment: "production_like",
        summary: "   ",
        securityConfigurationComplete: true,
        accessAndGovernanceComplete: true,
        dataAndRecoveryComplete: true,
        platformHealthComplete: true,
        functionalProofComplete: true,
        contractAndChainProofComplete: true,
        finalSignoffComplete: true,
        unresolvedRisksAccepted: false
      })
      .expect(400);

    expect(releaseReadinessService.requestApproval).not.toHaveBeenCalled();
  });

  it("passes governed launch approval requests through", async () => {
    releaseReadinessService.requestApproval.mockResolvedValue({
      approval: {
        id: "approval_1"
      }
    });

    const response = await request(app.getHttpServer())
      .post("/release-readiness/internal/approvals")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .set("x-operator-role", "operations_admin")
      .send({
        releaseIdentifier: "launch-2026.04.10.1",
        environment: "production_like",
        launchClosurePackId: "pack_1",
        rollbackReleaseIdentifier: "launch-rollback-2026.04.09.4",
        summary: "Production-like candidate is ready for governed approval.",
        requestNote: "Accepted evidence is complete and current.",
        securityConfigurationComplete: true,
        accessAndGovernanceComplete: true,
        dataAndRecoveryComplete: true,
        platformHealthComplete: true,
        functionalProofComplete: true,
        contractAndChainProofComplete: true,
        finalSignoffComplete: true,
        unresolvedRisksAccepted: false,
        openBlockers: [],
        residualRiskNote: "No accepted residual risk remains open."
      })
      .expect(201);

    expect(releaseReadinessService.requestApproval).toHaveBeenCalledWith(
      {
        releaseIdentifier: "launch-2026.04.10.1",
        environment: "production_like",
        launchClosurePackId: "pack_1",
        rollbackReleaseIdentifier: "launch-rollback-2026.04.09.4",
        summary: "Production-like candidate is ready for governed approval.",
        requestNote: "Accepted evidence is complete and current.",
        securityConfigurationComplete: true,
        accessAndGovernanceComplete: true,
        dataAndRecoveryComplete: true,
        platformHealthComplete: true,
        functionalProofComplete: true,
        contractAndChainProofComplete: true,
        finalSignoffComplete: true,
        unresolvedRisksAccepted: false,
        openBlockers: [],
        residualRiskNote: "No accepted residual risk remains open."
      },
      "ops_1",
      "operations_admin"
    );
    expect(response.body).toEqual({
      status: "success",
      message: "Release readiness approval requested successfully.",
      data: {
        approval: {
          id: "approval_1"
        }
      }
    });
  });

  it("rejects malformed approval notes", async () => {
    await request(app.getHttpServer())
      .post("/release-readiness/internal/approvals/approval_1/approve")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_2")
      .send({
        expectedUpdatedAt: "2026-04-10T12:00:00.000Z",
        approvalNote: "   "
      })
      .expect(400);

    expect(releaseReadinessService.approveApproval).not.toHaveBeenCalled();
  });

  it("rebinds a pending approval to a newer launch-closure pack", async () => {
    releaseReadinessService.rebindApprovalToLaunchClosurePack.mockResolvedValue({
      approval: {
        id: "approval_1",
        launchClosurePack: {
          id: "pack_2",
          version: 2,
          artifactChecksumSha256: "checksum_2"
        }
      }
    });

    const response = await request(app.getHttpServer())
      .post("/release-readiness/internal/approvals/approval_1/rebind-pack")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .set("x-operator-role", "operations_admin")
      .send({
        launchClosurePackId: "pack_2",
        expectedUpdatedAt: "2026-04-10T12:00:00.000Z"
      })
      .expect(201);

    expect(
      releaseReadinessService.rebindApprovalToLaunchClosurePack
    ).toHaveBeenCalledWith(
      "approval_1",
      "pack_2",
      "2026-04-10T12:00:00.000Z",
      "ops_1",
      "operations_admin"
    );
    expect(response.body.data.approval.launchClosurePack.id).toBe("pack_2");
  });

  it("passes governed approval decisions through", async () => {
    releaseReadinessService.approveApproval.mockResolvedValue({
      approval: {
        id: "approval_1"
      }
    });

    const response = await request(app.getHttpServer())
      .post("/release-readiness/internal/approvals/approval_1/approve")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_2")
      .set("x-operator-role", "compliance_lead")
      .send({
        expectedUpdatedAt: "2026-04-10T12:00:00.000Z",
        approvalNote: "Approved after verifying current accepted evidence."
      })
      .expect(201);

    expect(releaseReadinessService.approveApproval).toHaveBeenCalledWith(
      "approval_1",
      {
        expectedUpdatedAt: "2026-04-10T12:00:00.000Z",
        approvalNote: "Approved after verifying current accepted evidence."
      },
      "ops_2",
      "compliance_lead"
    );
    expect(response.body).toEqual({
      status: "success",
      message: "Release readiness approval completed successfully.",
      data: {
        approval: {
          id: "approval_1"
        }
      }
    });
  });

  it("returns approval lineage through the dedicated endpoint", async () => {
    releaseReadinessService.getApprovalLineage.mockResolvedValue({
      approval: {
        id: "approval_2"
      },
      lineage: [
        {
          id: "approval_1"
        },
        {
          id: "approval_2"
        }
      ],
      currentMutationToken: "2026-04-10T12:00:00.000Z",
      integrity: {
        status: "healthy",
        issues: [],
        headApprovalId: "approval_2",
        tailApprovalId: "approval_1",
        actionableApprovalId: null
      }
    });

    const response = await request(app.getHttpServer())
      .get("/release-readiness/internal/approvals/approval_2/lineage")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_2")
      .expect(200);

    expect(releaseReadinessService.getApprovalLineage).toHaveBeenCalledWith(
      "approval_2"
    );
    expect(response.body).toEqual({
      status: "success",
      message: "Release readiness approval lineage retrieved successfully.",
      data: {
        approval: {
          id: "approval_2"
        },
        lineage: [
          {
            id: "approval_1"
          },
          {
            id: "approval_2"
          }
        ],
        currentMutationToken: "2026-04-10T12:00:00.000Z",
        integrity: {
          status: "healthy",
          issues: [],
          headApprovalId: "approval_2",
          tailApprovalId: "approval_1",
          actionableApprovalId: null
        }
      }
    });
  });

  it("rejects malformed rejection notes", async () => {
    await request(app.getHttpServer())
      .post("/release-readiness/internal/approvals/approval_1/reject")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_2")
      .send({
        expectedUpdatedAt: "2026-04-10T12:00:00.000Z",
        rejectionNote: "   "
      })
      .expect(400);

    expect(releaseReadinessService.rejectApproval).not.toHaveBeenCalled();
  });

  it("passes governed rejection decisions through", async () => {
    releaseReadinessService.rejectApproval.mockResolvedValue({
      approval: {
        id: "approval_1"
      }
    });

    const response = await request(app.getHttpServer())
      .post("/release-readiness/internal/approvals/approval_1/reject")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_2")
      .set("x-operator-role", "compliance_lead")
      .send({
        expectedUpdatedAt: "2026-04-10T12:00:00.000Z",
        rejectionNote: "Critical evidence is stale and must be refreshed."
      })
      .expect(201);

    expect(releaseReadinessService.rejectApproval).toHaveBeenCalledWith(
      "approval_1",
      {
        expectedUpdatedAt: "2026-04-10T12:00:00.000Z",
        rejectionNote: "Critical evidence is stale and must be refreshed."
      },
      "ops_2",
      "compliance_lead"
    );
    expect(response.body).toEqual({
      status: "success",
      message: "Release readiness approval rejected successfully.",
      data: {
        approval: {
          id: "approval_1"
        }
      }
    });
  });

  it("validates launch-closure manifests through the HTTP boundary", async () => {
    const response = await request(app.getHttpServer())
      .post("/release-readiness/internal/launch-closure/validate")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .send({
        manifest: buildLaunchClosureManifest()
      })
      .expect(201);

    expect(response.body.status).toBe("success");
    expect(response.body.message).toBe(
      "Launch-closure manifest validated successfully."
    );
    expect(response.body.data.validation.errors).toEqual([]);
    expect(response.body.data.summaryMarkdown).toContain(
      "Launch-Closure Manifest Validation"
    );
  });

  it("passes scoped launch-closure status filters through", async () => {
    releaseReadinessService.getLaunchClosureStatus.mockResolvedValue({
      generatedAt: "2026-04-10T12:00:00.000Z",
      releaseIdentifier: "launch-2026.04.10.1",
      environment: "production_like",
      overallStatus: "blocked",
      maximumEvidenceAgeHours: 72,
      externalChecks: [],
      latestApproval: null,
      summaryMarkdown: "Scoped launch-closure status."
    });

    const response = await request(app.getHttpServer())
      .get("/release-readiness/internal/launch-closure/status")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .query({
        releaseIdentifier: "launch-2026.04.10.1",
        environment: "production_like"
      })
      .expect(200);

    expect(releaseReadinessService.getLaunchClosureStatus).toHaveBeenCalledWith(
      {
        releaseIdentifier: "launch-2026.04.10.1",
        environment: "production_like"
      },
      {
        operatorId: "ops_1",
        operatorRole: undefined
      }
    );
    expect(response.body.data.summaryMarkdown).toContain(
      "Scoped launch-closure status."
    );
  });

  it("lists stored launch-closure packs through the HTTP boundary", async () => {
    releaseReadinessService.listLaunchClosurePacks.mockResolvedValue({
      packs: [
        {
          id: "pack_1"
        }
      ],
      limit: 20,
      totalCount: 1
    });

    const response = await request(app.getHttpServer())
      .get("/release-readiness/internal/launch-closure/packs")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .query({
        releaseIdentifier: "launch-2026.04.10.1",
        environment: "production_like",
        limit: "20"
      })
      .expect(200);

    expect(releaseReadinessService.listLaunchClosurePacks).toHaveBeenCalledWith({
      releaseIdentifier: "launch-2026.04.10.1",
      environment: "production_like",
      limit: 20
    });
    expect(response.body.data.totalCount).toBe(1);
  });

  it("retrieves a stored launch-closure pack through the HTTP boundary", async () => {
    releaseReadinessService.getLaunchClosurePack.mockResolvedValue({
      pack: {
        id: "pack_1"
      }
    });

    const response = await request(app.getHttpServer())
      .get("/release-readiness/internal/launch-closure/packs/pack_1")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .expect(200);

    expect(releaseReadinessService.getLaunchClosurePack).toHaveBeenCalledWith(
      "pack_1"
    );
    expect(response.body.data.pack.id).toBe("pack_1");
  });

  it("rejects invalid launch-closure scaffold requests before pack generation", async () => {
    await request(app.getHttpServer())
      .post("/release-readiness/internal/launch-closure/scaffold")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .send({
        manifest: {
          ...buildLaunchClosureManifest(),
          operator: {
            requesterId: "ops_1",
            requesterRole: "operations_admin",
            approverId: "ops_1",
            approverRole: "compliance_lead",
            apiKeyEnvironmentVariable: "INTERNAL_OPERATOR_API_KEY"
          }
        }
      })
      .expect(400);
  });

  it("scaffolds launch-closure previews when the manifest is valid", async () => {
    const response = await request(app.getHttpServer())
      .post("/release-readiness/internal/launch-closure/scaffold")
      .set("x-operator-api-key", "test-operator-key")
      .set("x-operator-id", "ops_1")
      .set("x-operator-role", "operations_admin")
      .send({
        manifest: buildLaunchClosureManifest()
      })
      .expect(201);

    expect(response.body.status).toBe("success");
    expect(response.body.message).toBe("Launch-closure pack generated successfully.");
    expect(response.body.data.validation.errors).toEqual([]);
    expect(response.body.data.outputSubpath).toContain(
      "launch-2026.04.10.1-production_like"
    );
    expect(releaseReadinessService.storeLaunchClosurePack).toHaveBeenCalledWith(
      buildLaunchClosureManifest(),
      "ops_1",
      "operations_admin"
    );
    expect(response.body.data.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          relativePath: "README.md"
        }),
        expect.objectContaining({
          relativePath: "README.md"
        })
      ])
    );
    expect(response.body.data.pack.id).toBe("pack_1");
  });
});
