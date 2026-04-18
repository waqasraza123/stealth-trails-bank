import {
  SolvencyEvidenceFreshness,
  SolvencyPolicyStateStatus,
  SolvencySnapshotStatus,
  WorkerRuntimeEnvironment
} from "@prisma/client";
import { SolvencyService } from "./solvency.service";
import { SolvencyWorkerController } from "./solvency-worker.controller";

function createController() {
  const solvencyService = {
    generateSnapshot: jest.fn()
  } as unknown as jest.Mocked<SolvencyService>;

  return {
    controller: new SolvencyWorkerController(solvencyService),
    solvencyService
  };
}

describe("SolvencyWorkerController", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("runs a solvency snapshot with the internal worker identity", async () => {
    const { controller, solvencyService } = createController();
    (solvencyService.generateSnapshot as jest.Mock).mockResolvedValue({
      snapshot: {
        id: "snapshot_1",
        environment: WorkerRuntimeEnvironment.production,
        status: SolvencySnapshotStatus.warning,
        evidenceFreshness: SolvencyEvidenceFreshness.stale,
        generatedAt: "2026-04-18T00:00:00.000Z",
        completedAt: "2026-04-18T00:00:01.000Z",
        totalLiabilityAmount: "10",
        totalObservedReserveAmount: "12",
        totalUsableReserveAmount: "11",
        totalEncumberedReserveAmount: "1",
        totalReserveDeltaAmount: "1",
        assetCount: 1,
        issueCount: 1,
        policyActionsTriggered: false,
        failureCode: null,
        failureMessage: null
      },
      policyState: {
        environment: WorkerRuntimeEnvironment.production,
        status: SolvencyPolicyStateStatus.guarded,
        pauseWithdrawalApprovals: false,
        pauseManagedWithdrawalExecution: false,
        pauseLoanFunding: false,
        pauseStakingWrites: false,
        requireManualOperatorReview: true,
        latestSnapshotId: "snapshot_1",
        triggeredAt: "2026-04-18T00:00:01.000Z",
        clearedAt: null,
        reasonCode: "reserve_evidence_stale",
        reasonSummary: "ETH reserve evidence is stale.",
        metadata: null,
        updatedAt: "2026-04-18T00:00:01.000Z"
      },
      issueCount: 1,
      criticalIssueCount: 0
    });

    const response = await controller.runSnapshot({
      internalWorker: {
        workerId: "worker_1"
      }
    });

    expect(solvencyService.generateSnapshot).toHaveBeenCalledWith({
      actorType: "worker",
      actorId: "worker_1"
    });
    expect(response.status).toBe("success");
    expect(response.message).toContain("Worker-triggered");
  });
});
