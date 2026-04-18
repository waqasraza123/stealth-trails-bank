import {
  SolvencyEvidenceFreshness,
  SolvencyPolicyStateStatus,
  SolvencySnapshotStatus,
  WorkerRuntimeEnvironment
} from "@prisma/client";
import { SolvencyController } from "./solvency.controller";
import { SolvencyService } from "./solvency.service";

function createController() {
  const solvencyService = {
    getWorkspace: jest.fn(),
    getSnapshotDetail: jest.fn(),
    generateSnapshot: jest.fn(),
    requestPolicyResume: jest.fn(),
    approvePolicyResume: jest.fn(),
    rejectPolicyResume: jest.fn()
  } as unknown as jest.Mocked<SolvencyService>;

  return {
    controller: new SolvencyController(solvencyService),
    solvencyService
  };
}

describe("SolvencyController", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns the solvency workspace for operators", async () => {
    const { controller, solvencyService } = createController();
    (solvencyService.getWorkspace as jest.Mock).mockResolvedValue({
      generatedAt: "2026-04-18T00:00:00.000Z",
      policyState: {
        environment: WorkerRuntimeEnvironment.production,
        status: SolvencyPolicyStateStatus.normal,
        pauseWithdrawalApprovals: false,
        pauseManagedWithdrawalExecution: false,
        pauseLoanFunding: false,
        pauseStakingWrites: false,
        requireManualOperatorReview: false,
        latestSnapshotId: "snapshot_1",
        triggeredAt: null,
        clearedAt: null,
        reasonCode: null,
        reasonSummary: null,
        manualResumeRequired: false,
        manualResumeRequestedAt: null,
        manualResumeApprovedAt: null,
        manualResumeApprovedByOperatorId: null,
        manualResumeApprovedByOperatorRole: null,
        metadata: null,
        updatedAt: "2026-04-18T00:00:00.000Z"
      },
      resumeGovernance: {
        requestAllowedOperatorRoles: ["operations_admin"],
        approverAllowedOperatorRoles: ["risk_manager"],
        currentOperator: {
          operatorId: "operator_1",
          operatorRole: "operations_admin",
          canRequestResume: true,
          canApproveResume: false
        }
      },
      latestPendingResumeRequest: null,
      latestSnapshot: null,
      latestHealthySnapshotAt: null,
      recentSnapshots: [],
      limit: 20
    });

    const response = await controller.getWorkspace({
      limit: 20
    }, {
      internalOperator: {
        operatorId: "operator_1",
        operatorRole: "operations_admin"
      }
    });

    expect(solvencyService.getWorkspace).toHaveBeenCalledWith(20, {
      operatorId: "operator_1",
      operatorRole: "operations_admin"
    });
    expect(response.status).toBe("success");
    expect(response.message).toContain("workspace");
  });

  it("runs a solvency snapshot with the internal operator identity", async () => {
    const { controller, solvencyService } = createController();
    (solvencyService.generateSnapshot as jest.Mock).mockResolvedValue({
      snapshot: {
        id: "snapshot_1",
        environment: WorkerRuntimeEnvironment.production,
        status: SolvencySnapshotStatus.healthy,
        evidenceFreshness: SolvencyEvidenceFreshness.fresh,
        generatedAt: "2026-04-18T00:00:00.000Z",
        completedAt: "2026-04-18T00:00:01.000Z",
        totalLiabilityAmount: "10",
        totalObservedReserveAmount: "12",
        totalUsableReserveAmount: "12",
        totalEncumberedReserveAmount: "0",
        totalReserveDeltaAmount: "2",
        assetCount: 1,
        issueCount: 0,
        policyActionsTriggered: false,
        failureCode: null,
        failureMessage: null
      },
      policyState: {
        environment: WorkerRuntimeEnvironment.production,
        status: SolvencyPolicyStateStatus.normal,
        pauseWithdrawalApprovals: false,
        pauseManagedWithdrawalExecution: false,
        pauseLoanFunding: false,
        pauseStakingWrites: false,
        requireManualOperatorReview: false,
        latestSnapshotId: "snapshot_1",
        triggeredAt: null,
        clearedAt: null,
        reasonCode: null,
        reasonSummary: null,
        manualResumeRequired: false,
        manualResumeRequestedAt: null,
        manualResumeApprovedAt: null,
        manualResumeApprovedByOperatorId: null,
        manualResumeApprovedByOperatorRole: null,
        metadata: null,
        updatedAt: "2026-04-18T00:00:01.000Z"
      },
      issueCount: 0,
      criticalIssueCount: 0
    });

    const response = await controller.runSnapshot({
      internalOperator: {
        operatorId: "operator_1"
      }
    });

    expect(solvencyService.generateSnapshot).toHaveBeenCalledWith({
      actorType: "operator",
      actorId: "operator_1"
    });
    expect(response.status).toBe("success");
    expect(response.message).toContain("generated");
  });

  it("requests governed manual resume through the operator identity", async () => {
    const { controller, solvencyService } = createController();
    (solvencyService.requestPolicyResume as jest.Mock).mockResolvedValue({
      policyState: {
        environment: WorkerRuntimeEnvironment.production,
        status: SolvencyPolicyStateStatus.paused,
        pauseWithdrawalApprovals: true,
        pauseManagedWithdrawalExecution: true,
        pauseLoanFunding: true,
        pauseStakingWrites: true,
        requireManualOperatorReview: true,
        latestSnapshotId: "snapshot_healthy",
        triggeredAt: "2026-04-18T00:00:00.000Z",
        clearedAt: null,
        reasonCode: "manual_resume_required",
        reasonSummary: "Manual resume approval required.",
        manualResumeRequired: true,
        manualResumeRequestedAt: "2026-04-18T00:01:00.000Z",
        manualResumeApprovedAt: null,
        manualResumeApprovedByOperatorId: null,
        manualResumeApprovedByOperatorRole: null,
        metadata: null,
        updatedAt: "2026-04-18T00:01:00.000Z"
      },
      request: {
        id: "resume_1",
        environment: WorkerRuntimeEnvironment.production,
        snapshotId: "snapshot_healthy",
        status: "pending_approval",
        requestedByOperatorId: "operator_1",
        requestedByOperatorRole: "operations_admin",
        requestNote: null,
        expectedPolicyUpdatedAt: "2026-04-18T00:00:00.000Z",
        requestedAt: "2026-04-18T00:01:00.000Z",
        approvedByOperatorId: null,
        approvedByOperatorRole: null,
        approvalNote: null,
        approvedAt: null,
        rejectedByOperatorId: null,
        rejectedByOperatorRole: null,
        rejectionNote: null,
        rejectedAt: null,
        updatedAt: "2026-04-18T00:01:00.000Z"
      }
    });

    const response = await controller.requestPolicyResume(
      {
        snapshotId: "snapshot_healthy",
        expectedPolicyUpdatedAt: "2026-04-18T00:00:00.000Z"
      },
      {
        internalOperator: {
          operatorId: "operator_1",
          operatorRole: "operations_admin"
        }
      }
    );

    expect(solvencyService.requestPolicyResume).toHaveBeenCalledWith(
      "snapshot_healthy",
      "2026-04-18T00:00:00.000Z",
      undefined,
      "operator_1",
      "operations_admin"
    );
    expect(response.status).toBe("success");
  });
});
