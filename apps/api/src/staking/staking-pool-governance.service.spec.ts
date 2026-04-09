jest.mock("@stealth-trails-bank/config/api", () => ({
  loadStakingPoolGovernanceRuntimeConfig: () => ({
    stakingPoolGovernanceRequestAllowedOperatorRoles: [
      "treasury",
      "risk_manager",
      "compliance_lead"
    ],
    stakingPoolGovernanceApproverAllowedOperatorRoles: [
      "risk_manager",
      "compliance_lead"
    ],
    stakingPoolGovernanceExecutorAllowedOperatorRoles: ["treasury"]
  })
}));

import { ForbiddenException } from "@nestjs/common";
import { StakingPoolGovernanceService } from "./staking-pool-governance.service";

describe("StakingPoolGovernanceService", () => {
  function createGovernanceRequestRecord(
    overrides: Record<string, unknown> = {}
  ) {
    return {
      id: "request_1",
      rewardRate: 12,
      status: "pending_approval",
      requestedByOperatorId: "treasury_requester",
      requestedByOperatorRole: "treasury",
      approvedByOperatorId: null,
      approvedByOperatorRole: null,
      rejectedByOperatorId: null,
      rejectedByOperatorRole: null,
      executedByOperatorId: null,
      executedByOperatorRole: null,
      requestNote: "Need a new managed pool.",
      approvalNote: null,
      rejectionNote: null,
      executionNote: null,
      executionFailureReason: null,
      blockchainTransactionHash: null,
      stakingPoolId: null,
      stakingPool: null,
      requestedAt: new Date("2026-04-09T10:00:00.000Z"),
      approvedAt: null,
      rejectedAt: null,
      executedAt: null,
      createdAt: new Date("2026-04-09T10:00:00.000Z"),
      updatedAt: new Date("2026-04-09T10:00:00.000Z"),
      ...overrides
    };
  }

  function createService() {
    let prismaService: any;

    prismaService = {
      $transaction: jest.fn(async (callback: (transaction: unknown) => unknown) =>
        callback(prismaService)
      ),
      stakingPoolGovernanceRequest: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn()
      },
      auditEvent: {
        create: jest.fn()
      }
    };

    const stakingService = {
      executeGovernedPoolCreation: jest.fn()
    };

    const service = new StakingPoolGovernanceService(
      prismaService as never,
      stakingService as never
    );

    return {
      service,
      prismaService,
      stakingService
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("records a durable governance request with operator audit metadata", async () => {
    const { service, prismaService } = createService();

    prismaService.stakingPoolGovernanceRequest.create.mockResolvedValue(
      createGovernanceRequestRecord()
    );
    prismaService.auditEvent.create.mockResolvedValue({});

    const result = await service.createRequest(
      {
        rewardRate: 12,
        requestNote: "Need a new managed pool."
      },
      "treasury_requester",
      "treasury"
    );

    expect(result.stateReused).toBe(false);
    expect(result.request.status).toBe("pending_approval");
    expect(result.request.requestedByOperatorRole).toBe("treasury");
    expect(prismaService.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "staking.pool_creation.requested",
        targetType: "StakingPoolGovernanceRequest",
        metadata: expect.objectContaining({
          rewardRate: 12,
          requestNote: "Need a new managed pool.",
          operatorRole: "treasury"
        })
      })
    });
  });

  it("blocks self-approval so the requester cannot approve the same governance request", async () => {
    const { service, prismaService } = createService();

    prismaService.stakingPoolGovernanceRequest.findUnique.mockResolvedValue(
      createGovernanceRequestRecord()
    );

    await expect(
      service.approveRequest(
        "request_1",
        {
          approvalNote: "approved"
        },
        "treasury_requester",
        "risk_manager"
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("blocks approval for operator roles outside the governance approver policy", async () => {
    const { service } = createService();

    await expect(
      service.approveRequest(
        "request_1",
        {
          approvalNote: "approved"
        },
        "ops_1",
        "operations_admin"
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("executes an approved governance request and links the created pool", async () => {
    const { service, prismaService, stakingService } = createService();

    prismaService.stakingPoolGovernanceRequest.findUnique.mockResolvedValue(
      createGovernanceRequestRecord({
        status: "approved",
        approvedByOperatorId: "risk_approver",
        approvedByOperatorRole: "risk_manager",
        approvedAt: new Date("2026-04-09T11:00:00.000Z")
      })
    );
    stakingService.executeGovernedPoolCreation.mockResolvedValue({
      success: true,
      poolId: 17,
      blockchainPoolId: 17,
      transactionHash: "0xpoolhash",
      poolStatus: "paused"
    });
    prismaService.stakingPoolGovernanceRequest.update.mockResolvedValue(
      createGovernanceRequestRecord({
        status: "executed",
        approvedByOperatorId: "risk_approver",
        approvedByOperatorRole: "risk_manager",
        approvedAt: new Date("2026-04-09T11:00:00.000Z"),
        executedByOperatorId: "treasury_executor",
        executedByOperatorRole: "treasury",
        executionNote: "Executed through the treasury signer.",
        executedAt: new Date("2026-04-09T11:05:00.000Z"),
        stakingPoolId: 17,
        blockchainTransactionHash: "0xpoolhash",
        stakingPool: {
          id: 17,
          blockchainPoolId: 17,
          rewardRate: 12,
          poolStatus: "paused",
          createdAt: new Date("2026-04-09T11:05:00.000Z"),
          updatedAt: new Date("2026-04-09T11:05:00.000Z")
        }
      })
    );
    prismaService.auditEvent.create.mockResolvedValue({});

    const result = await service.executeRequest(
      "request_1",
      {
        executionNote: "Executed through the treasury signer."
      },
      "treasury_executor",
      "treasury"
    );

    expect(result.stateReused).toBe(false);
    expect(result.request.status).toBe("executed");
    expect(result.request.stakingPool?.id).toBe(17);
    expect(stakingService.executeGovernedPoolCreation).toHaveBeenCalledWith({
      rewardRate: 12,
      operatorId: "treasury_executor",
      operatorRole: "treasury",
      stakingPoolId: null
    });
    expect(prismaService.stakingPoolGovernanceRequest.update).toHaveBeenCalledWith({
      where: {
        id: "request_1"
      },
      data: expect.objectContaining({
        status: "executed",
        executedByOperatorId: "treasury_executor",
        executedByOperatorRole: "treasury",
        stakingPoolId: 17,
        blockchainTransactionHash: "0xpoolhash"
      }),
      include: expect.any(Object)
    });
  });

  it("records retryable execution failure state with the linked local pool", async () => {
    const { service, prismaService, stakingService } = createService();

    prismaService.stakingPoolGovernanceRequest.findUnique.mockResolvedValue(
      createGovernanceRequestRecord({
        status: "approved",
        approvedByOperatorId: "risk_approver",
        approvedByOperatorRole: "risk_manager",
        approvedAt: new Date("2026-04-09T11:00:00.000Z")
      })
    );
    stakingService.executeGovernedPoolCreation.mockResolvedValue({
      success: false,
      poolId: 17,
      blockchainPoolId: 17,
      transactionHash: null,
      errorMessage: "rpc down"
    });
    prismaService.stakingPoolGovernanceRequest.update.mockResolvedValue(
      createGovernanceRequestRecord({
        status: "execution_failed",
        approvedByOperatorId: "risk_approver",
        approvedByOperatorRole: "risk_manager",
        approvedAt: new Date("2026-04-09T11:00:00.000Z"),
        executionFailureReason: "rpc down",
        stakingPoolId: 17,
        stakingPool: {
          id: 17,
          blockchainPoolId: 17,
          rewardRate: 12,
          poolStatus: "paused",
          createdAt: new Date("2026-04-09T11:05:00.000Z"),
          updatedAt: new Date("2026-04-09T11:05:00.000Z")
        }
      })
    );
    prismaService.auditEvent.create.mockResolvedValue({});

    const result = await service.executeRequest(
      "request_1",
      {
        executionNote: "Retry after RPC recovery."
      },
      "treasury_executor",
      "treasury"
    );

    expect(result.stateReused).toBe(false);
    expect(result.request.status).toBe("execution_failed");
    expect(result.request.executionFailureReason).toBe("rpc down");
    expect(prismaService.stakingPoolGovernanceRequest.update).toHaveBeenCalledWith({
      where: {
        id: "request_1"
      },
      data: expect.objectContaining({
        status: "execution_failed",
        executionFailureReason: "rpc down",
        stakingPoolId: 17
      }),
      include: expect.any(Object)
    });
  });

  it("blocks execution for operator roles outside the treasury executor policy", async () => {
    const { service } = createService();

    await expect(
      service.executeRequest(
        "request_1",
        {
          executionNote: "attempted with the wrong role"
        },
        "ops_1",
        "risk_manager"
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
