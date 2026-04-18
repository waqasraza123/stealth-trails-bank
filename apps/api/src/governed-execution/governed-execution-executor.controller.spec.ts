import { GovernedExecutionExecutorController } from "./governed-execution-executor.controller";
import { GovernedExecutionService } from "./governed-execution.service";

function createController() {
  const governedExecutionService = {
    listExecutorReadyExecutionRequests: jest.fn(),
    claimExecutionForExecutor: jest.fn(),
    recordExecutionSuccessFromExecutor: jest.fn(),
    recordExecutionFailureFromExecutor: jest.fn()
  } as unknown as GovernedExecutionService;

  return {
    controller: new GovernedExecutionExecutorController(governedExecutionService),
    governedExecutionService
  };
}

describe("GovernedExecutionExecutorController", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("lists executor-ready requests", async () => {
    const { controller, governedExecutionService } = createController();
    (
      governedExecutionService.listExecutorReadyExecutionRequests as jest.Mock
    ).mockResolvedValue({
      requests: [],
      limit: 10,
      generatedAt: "2026-04-18T12:00:00.000Z"
    });

    const result = await controller.listReadyExecutionRequests({
      limit: 10
    });

    expect(
      governedExecutionService.listExecutorReadyExecutionRequests
    ).toHaveBeenCalledWith(10);
    expect(result.status).toBe("success");
  });

  it("claims a dispatched request for the current executor", async () => {
    const { controller, governedExecutionService } = createController();
    (governedExecutionService.claimExecutionForExecutor as jest.Mock).mockResolvedValue(
      {
        request: {
          id: "execution_request_1"
        },
        claimReused: false
      }
    );

    await controller.claimExecutionRequest(
      "execution_request_1",
      {
        reclaimStaleAfterMs: 180000
      },
      {
        internalGovernedExecutor: {
          executorId: "executor_1"
        }
      }
    );

    expect(
      governedExecutionService.claimExecutionForExecutor
    ).toHaveBeenCalledWith("execution_request_1", "executor_1", 180000);
  });

  it("passes executor success receipts through", async () => {
    const { controller, governedExecutionService } = createController();
    (
      governedExecutionService.recordExecutionSuccessFromExecutor as jest.Mock
    ).mockResolvedValue({
      request: {
        id: "execution_request_1"
      }
    });

    await controller.recordExecutionSuccess(
      "execution_request_1",
      {
        dispatchReference: "dispatch_1",
        transactionChainId: 8453,
        transactionToAddress: "0x0000000000000000000000000000000000000abc",
        blockchainTransactionHash: "0xhash",
        notedAt: "2030-04-18T10:03:00.000Z",
        canonicalReceiptText: "{\"receipt\":true}",
        receiptHash: "0xreceipt",
        receiptChecksumSha256: "checksum",
        receiptSignature: "0xsig",
        receiptSignerAddress: "0xsigner",
        receiptSignatureAlgorithm: "ethereum-secp256k1-keccak256-v1"
      },
      {
        internalGovernedExecutor: {
          executorId: "executor_1"
        }
      }
    );

    expect(
      governedExecutionService.recordExecutionSuccessFromExecutor
    ).toHaveBeenCalledWith(
      "execution_request_1",
      {
        dispatchReference: "dispatch_1",
        transactionChainId: 8453,
        transactionToAddress: "0x0000000000000000000000000000000000000abc",
        blockchainTransactionHash: "0xhash",
        notedAt: "2030-04-18T10:03:00.000Z",
        canonicalReceiptText: "{\"receipt\":true}",
        receiptHash: "0xreceipt",
        receiptChecksumSha256: "checksum",
        receiptSignature: "0xsig",
        receiptSignerAddress: "0xsigner",
        receiptSignatureAlgorithm: "ethereum-secp256k1-keccak256-v1"
      },
      "executor_1"
    );
  });

  it("passes executor failure receipts through", async () => {
    const { controller, governedExecutionService } = createController();
    (
      governedExecutionService.recordExecutionFailureFromExecutor as jest.Mock
    ).mockResolvedValue({
      request: {
        id: "execution_request_1"
      }
    });

    await controller.recordExecutionFailure(
      "execution_request_1",
      {
        dispatchReference: "dispatch_1",
        failureReason: "multisig_rejected",
        notedAt: "2030-04-18T10:03:00.000Z",
        canonicalReceiptText: "{\"receipt\":true}",
        receiptHash: "0xreceipt",
        receiptChecksumSha256: "checksum",
        receiptSignature: "0xsig",
        receiptSignerAddress: "0xsigner",
        receiptSignatureAlgorithm: "ethereum-secp256k1-keccak256-v1"
      },
      {
        internalGovernedExecutor: {
          executorId: "executor_1"
        }
      }
    );

    expect(
      governedExecutionService.recordExecutionFailureFromExecutor
    ).toHaveBeenCalledWith(
      "execution_request_1",
      {
        dispatchReference: "dispatch_1",
        failureReason: "multisig_rejected",
        notedAt: "2030-04-18T10:03:00.000Z",
        canonicalReceiptText: "{\"receipt\":true}",
        receiptHash: "0xreceipt",
        receiptChecksumSha256: "checksum",
        receiptSignature: "0xsig",
        receiptSignerAddress: "0xsigner",
        receiptSignatureAlgorithm: "ethereum-secp256k1-keccak256-v1"
      },
      "executor_1"
    );
  });
});
