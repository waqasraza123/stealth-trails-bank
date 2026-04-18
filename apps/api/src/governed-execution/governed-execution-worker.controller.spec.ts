import { GovernedExecutionWorkerController } from "./governed-execution-worker.controller";
import { GovernedExecutionService } from "./governed-execution.service";

function createController() {
  const governedExecutionService = {
    listClaimableExecutionRequests: jest.fn(),
    claimExecutionRequest: jest.fn(),
    dispatchExecutionRequest: jest.fn()
  } as unknown as GovernedExecutionService;

  return {
    controller: new GovernedExecutionWorkerController(governedExecutionService),
    governedExecutionService
  };
}

describe("GovernedExecutionWorkerController", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("lists claimable execution requests", async () => {
    const { controller, governedExecutionService } = createController();
    (governedExecutionService.listClaimableExecutionRequests as jest.Mock).mockResolvedValue(
      {
        requests: [],
        limit: 10,
        generatedAt: "2026-04-18T12:00:00.000Z"
      }
    );

    const result = await controller.listClaimableExecutionRequests({
      limit: 10
    });

    expect(governedExecutionService.listClaimableExecutionRequests).toHaveBeenCalledWith(
      10
    );
    expect(result.status).toBe("success");
  });

  it("claims an execution request for the current worker", async () => {
    const { controller, governedExecutionService } = createController();
    (governedExecutionService.claimExecutionRequest as jest.Mock).mockResolvedValue({
      request: {
        id: "execution_request_1"
      },
      claimReused: false
    });

    await controller.claimExecutionRequest(
      "execution_request_1",
      {
        reclaimStaleAfterMs: 120000
      },
      {
        internalWorker: {
          workerId: "worker_1"
        }
      }
    );

    expect(governedExecutionService.claimExecutionRequest).toHaveBeenCalledWith(
      "execution_request_1",
      "worker_1",
      120000
    );
  });

  it("records dispatch for a claimed execution request", async () => {
    const { controller, governedExecutionService } = createController();
    (governedExecutionService.dispatchExecutionRequest as jest.Mock).mockResolvedValue(
      {
        request: {
          id: "execution_request_1"
        },
        dispatchRecorded: true,
        verificationSucceeded: true,
        verificationFailureReason: null
      }
    );

    await controller.dispatchExecutionRequest(
      "execution_request_1",
      {
        dispatchReference: "worker:worker_1:execution_request_1"
      },
      {
        internalWorker: {
          workerId: "worker_1"
        }
      }
    );

    expect(governedExecutionService.dispatchExecutionRequest).toHaveBeenCalledWith(
      "execution_request_1",
      {
        dispatchReference: "worker:worker_1:execution_request_1"
      },
      "worker_1"
    );
  });
});
