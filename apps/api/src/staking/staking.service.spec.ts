const mockReadContract = {
  getTotalStaked: jest.fn(),
  getStakedBalance: jest.fn(),
  getPendingReward: jest.fn(),
  createPool: jest.fn(),
  deposit: jest.fn(),
  withdraw: jest.fn(),
  claimReward: jest.fn(),
  emergencyWithdraw: jest.fn()
};

const mockWriteContract = {
  createPool: jest.fn(),
  deposit: jest.fn(),
  withdraw: jest.fn(),
  claimReward: jest.fn(),
  emergencyWithdraw: jest.fn()
};

const mockWriteWallet = {
  address: "0x9999000011112222333344445555666677778888"
};

const parseEtherMock = jest.fn();

function createBigNumber(value: string | bigint | number) {
  const normalizedValue = BigInt(value);

  return {
    toString: () => normalizedValue.toString(),
    lte: (other: string | bigint | number | { toString(): string }) =>
      normalizedValue <= BigInt(String(other)),
    lt: (other: string | bigint | number | { toString(): string }) =>
      normalizedValue < BigInt(String(other))
  };
}

function formatWeiToEthString(value: unknown): string {
  const normalizedValue = BigInt(String(value));
  const whole = normalizedValue / 1000000000000000000n;
  const fraction = normalizedValue % 1000000000000000000n;
  const fractionText = fraction.toString().padStart(18, "0").replace(/0+$/, "");
  return fractionText ? `${whole.toString()}.${fractionText}` : `${whole.toString()}.0`;
}

jest.mock("@stealth-trails-bank/config/api", () => ({
  loadOptionalBlockchainContractWriteRuntimeConfig: () => ({
    environment: "development",
    rpcUrl: "http://127.0.0.1:8545",
    stakingContractAddress: "0x0000000000000000000000000000000000000abc",
    ethereumPrivateKey:
      "0x1234567890123456789012345678901234567890123456789012345678901234"
  }),
  loadSensitiveOperatorActionPolicyRuntimeConfig: () => ({
    transactionIntentDecisionAllowedOperatorRoles: [
      "operations_admin",
      "risk_manager"
    ],
    custodyOperationAllowedOperatorRoles: [
      "operations_admin",
      "senior_operator",
      "treasury"
    ],
    stakingGovernanceAllowedOperatorRoles: [
      "treasury",
      "risk_manager",
      "compliance_lead"
    ]
  })
}));

jest.mock("ethers", () => ({
  ethers: {
    providers: {
      JsonRpcProvider: jest.fn().mockImplementation(() => ({}))
    },
    Wallet: jest.fn().mockImplementation(() => mockWriteWallet),
    Contract: jest
      .fn()
      .mockImplementation((_address: string, _abi: unknown, signerOrProvider: unknown) =>
        signerOrProvider === mockWriteWallet ? mockWriteContract : mockReadContract
      ),
    utils: {
      formatEther: (value: unknown) => formatWeiToEthString(value),
      parseEther: parseEtherMock
    }
  }
}));

import { StakingService } from "./staking.service";

describe("StakingService", () => {
  function createService() {
    const prismaService = {
      stakingPool: {
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn()
      },
      poolDeposit: {
        create: jest.fn(),
        update: jest.fn()
      },
      poolWithdrawal: {
        create: jest.fn(),
        update: jest.fn()
      },
      auditEvent: {
        create: jest.fn()
      }
    };

    const authService = {
      getCustomerAccountProjectionBySupabaseUserId: jest.fn(),
      getCustomerWalletProjectionBySupabaseUserId: jest.fn(),
      getUserFromDatabaseById: jest.fn()
    };
    const notificationsService = {
      publishAuditEventRecord: jest.fn().mockResolvedValue(undefined)
    };

    const service = new StakingService(
      prismaService as never,
      authService as never,
      notificationsService as never
    );

    return {
      service,
      prismaService,
      authService,
      notificationsService
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    parseEtherMock.mockImplementation((value: string) => {
      const [wholeText, fractionText = ""] = value.trim().split(".");
      const normalizedFraction = `${fractionText}000000000000000000`.slice(0, 18);
      const wei =
        BigInt(wholeText || "0") * 1000000000000000000n +
        BigInt(normalizedFraction || "0");
      return createBigNumber(wei);
    });
  });

  function mockExecutableCustomer(authService: {
    getCustomerAccountProjectionBySupabaseUserId: jest.Mock;
    getCustomerWalletProjectionBySupabaseUserId: jest.Mock;
    getUserFromDatabaseById: jest.Mock;
  }) {
    authService.getCustomerAccountProjectionBySupabaseUserId.mockResolvedValue({
      customer: {
        id: "customer_1",
        supabaseUserId: "supabase_1",
        email: "amina@example.com",
        firstName: "Amina",
        lastName: "Rahman",
        createdAt: new Date("2026-04-05T10:00:00.000Z"),
        updatedAt: new Date("2026-04-05T11:00:00.000Z")
      },
      customerAccount: {
        id: "account_1",
        status: "active",
        activatedAt: new Date("2026-04-05T10:00:00.000Z"),
        restrictedAt: null,
        frozenAt: null,
        closedAt: null,
        createdAt: new Date("2026-04-05T10:00:00.000Z"),
        updatedAt: new Date("2026-04-05T11:00:00.000Z")
      }
    });
    authService.getCustomerWalletProjectionBySupabaseUserId.mockResolvedValue({
      wallet: {
        id: "wallet_1",
        customerAccountId: "account_1",
        chainId: 8453,
        address: mockWriteWallet.address,
        kind: "embedded",
        custodyType: "platform_managed",
        status: "active",
        createdAt: new Date("2026-04-05T10:00:00.000Z"),
        updatedAt: new Date("2026-04-05T11:00:00.000Z")
      }
    });
    authService.getUserFromDatabaseById.mockResolvedValue({
      id: 1,
      ethereumAddress: mockWriteWallet.address
    });
  }

  it("returns live staking positions while keeping execution disabled on signer mismatch", async () => {
    const { service, prismaService, authService } = createService();

    prismaService.stakingPool.findMany.mockResolvedValue([
      {
        id: 11,
        blockchainPoolId: 101,
        rewardRate: 5,
        totalStakedAmount: 0n,
        totalRewardsPaid: 0n,
        poolStatus: "active",
        createdAt: new Date("2026-04-05T10:00:00.000Z"),
        updatedAt: new Date("2026-04-05T11:00:00.000Z")
      }
    ]);

    authService.getCustomerAccountProjectionBySupabaseUserId.mockResolvedValue({
      customer: {
        id: "customer_1",
        supabaseUserId: "supabase_1",
        email: "amina@example.com",
        firstName: "Amina",
        lastName: "Rahman",
        createdAt: new Date("2026-04-05T10:00:00.000Z"),
        updatedAt: new Date("2026-04-05T11:00:00.000Z")
      },
      customerAccount: {
        id: "account_1",
        status: "active",
        activatedAt: new Date("2026-04-05T10:00:00.000Z"),
        restrictedAt: null,
        frozenAt: null,
        closedAt: null,
        createdAt: new Date("2026-04-05T10:00:00.000Z"),
        updatedAt: new Date("2026-04-05T11:00:00.000Z")
      }
    });
    authService.getCustomerWalletProjectionBySupabaseUserId.mockResolvedValue({
      wallet: {
        id: "wallet_1",
        customerAccountId: "account_1",
        chainId: 8453,
        address: "0x1111222233334444555566667777888899990000",
        kind: "embedded",
        custodyType: "platform_managed",
        status: "active",
        createdAt: new Date("2026-04-05T10:00:00.000Z"),
        updatedAt: new Date("2026-04-05T11:00:00.000Z")
      }
    });
    authService.getUserFromDatabaseById.mockResolvedValue({
      id: 1,
      ethereumAddress: "0x1111222233334444555566667777888899990000"
    });

    mockReadContract.getTotalStaked.mockResolvedValue("32000000000000000000");
    mockReadContract.getStakedBalance.mockResolvedValue("1500000000000000000");
    mockReadContract.getPendingReward.mockResolvedValue("250000000000000000");

    const result = await service.getMySnapshot("supabase_1");

    expect(result.status).toBe("success");
    expect(result.data?.readModel.available).toBe(true);
    expect(result.data?.execution).toEqual({
      available: false,
      reasonCode: "signer_wallet_mismatch",
      message:
        "Customer staking execution is disabled because contract positions are keyed by the signing wallet, and the configured signer does not match this customer's managed wallet."
    });
    expect(result.data?.pools).toEqual([
      expect.objectContaining({
        id: 11,
        totalStakedAmount: "32.0",
        position: {
          stakedBalance: "1.5",
          pendingReward: "0.25",
          canReadPosition: true
        }
      })
    ]);
  });

  it("refuses customer deposits when execution capability is unsafe", async () => {
    const { service, prismaService, authService } = createService();

    authService.getCustomerAccountProjectionBySupabaseUserId.mockResolvedValue({
      customer: {
        id: "customer_1",
        supabaseUserId: "supabase_1",
        email: "amina@example.com",
        firstName: "Amina",
        lastName: "Rahman",
        createdAt: new Date("2026-04-05T10:00:00.000Z"),
        updatedAt: new Date("2026-04-05T11:00:00.000Z")
      },
      customerAccount: {
        id: "account_1",
        status: "active",
        activatedAt: new Date("2026-04-05T10:00:00.000Z"),
        restrictedAt: null,
        frozenAt: null,
        closedAt: null,
        createdAt: new Date("2026-04-05T10:00:00.000Z"),
        updatedAt: new Date("2026-04-05T11:00:00.000Z")
      }
    });
    authService.getCustomerWalletProjectionBySupabaseUserId.mockResolvedValue({
      wallet: {
        id: "wallet_1",
        customerAccountId: "account_1",
        chainId: 8453,
        address: "0x1111222233334444555566667777888899990000",
        kind: "embedded",
        custodyType: "platform_managed",
        status: "active",
        createdAt: new Date("2026-04-05T10:00:00.000Z"),
        updatedAt: new Date("2026-04-05T11:00:00.000Z")
      }
    });
    authService.getUserFromDatabaseById.mockResolvedValue({
      id: 1,
      ethereumAddress: "0x1111222233334444555566667777888899990000"
    });

    const result = await service.deposit(11, "1.25", "supabase_1");

    expect(result).toEqual({
      status: "failed",
      message:
        "Customer staking execution is disabled because contract positions are keyed by the signing wallet, and the configured signer does not match this customer's managed wallet."
    });
    expect(prismaService.poolDeposit.create).not.toHaveBeenCalled();
    expect(mockWriteContract.deposit).not.toHaveBeenCalled();
  });

  it("writes an audit event when governed pool creation executes", async () => {
    const { service, prismaService } = createService();

    prismaService.stakingPool.create.mockResolvedValue({
      id: 17,
      blockchainPoolId: null,
      rewardRate: 12,
      totalStakedAmount: 0n,
      totalRewardsPaid: 0n,
      poolStatus: "paused"
    });
    prismaService.stakingPool.update.mockResolvedValue({
      id: 17,
      blockchainPoolId: 17,
      rewardRate: 12,
      totalStakedAmount: 0n,
      totalRewardsPaid: 0n,
      poolStatus: "paused"
    });
    prismaService.auditEvent.create.mockResolvedValue({});
    mockWriteContract.createPool.mockResolvedValue({
      wait: jest.fn().mockResolvedValue({
        transactionHash: "0xpoolhash"
      })
    });

    const result = await service.executeGovernedPoolCreation({
      rewardRate: 12,
      operatorId: "ops_1",
      operatorRole: "treasury"
    });

    expect(result).toEqual({
      success: true,
      poolId: 17,
      blockchainPoolId: 17,
      transactionHash: "0xpoolhash",
      poolStatus: "paused"
    });
    expect(mockWriteContract.createPool).toHaveBeenCalledWith(12, 17);
    expect(prismaService.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        customerId: null,
        actorType: "operator",
        actorId: "ops_1",
        action: "staking.pool.executed",
        targetType: "StakingPool",
        targetId: "17",
        metadata: expect.objectContaining({
          rewardRate: 12,
          blockchainPoolId: 17,
          transactionHash: "0xpoolhash",
          actorRole: "treasury"
        })
      })
    });
  });

  it("returns retryable failure details when governed pool creation fails", async () => {
    const { service, prismaService } = createService();

    prismaService.stakingPool.create.mockResolvedValue({
      id: 17,
      blockchainPoolId: null,
      rewardRate: 12,
      totalStakedAmount: 0n,
      totalRewardsPaid: 0n,
      poolStatus: "paused"
    });
    prismaService.stakingPool.update.mockResolvedValue({
      id: 17,
      blockchainPoolId: 17,
      rewardRate: 12,
      totalStakedAmount: 0n,
      totalRewardsPaid: 0n,
      poolStatus: "paused"
    });
    prismaService.auditEvent.create.mockResolvedValue({});
    mockWriteContract.createPool.mockRejectedValue(new Error("rpc down"));

    const result = await service.executeGovernedPoolCreation({
      rewardRate: 12,
      operatorId: "ops_1",
      operatorRole: "treasury"
    });

    expect(result).toEqual({
      success: false,
      poolId: 17,
      blockchainPoolId: 17,
      transactionHash: null,
      errorMessage: "rpc down"
    });
    expect(prismaService.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "staking.pool.execution_failed",
        targetId: "17",
        metadata: expect.objectContaining({
          blockchainPoolId: 17,
          errorMessage: "rpc down",
          actorRole: "treasury"
        })
      })
    });
  });

  it("writes requested and completed audit events for a successful deposit", async () => {
    const { service, prismaService, authService } = createService();

    mockExecutableCustomer(authService);
    prismaService.stakingPool.findUnique.mockResolvedValue({
      id: 11,
      blockchainPoolId: 101,
      rewardRate: 5,
      totalStakedAmount: 0n,
      totalRewardsPaid: 0n,
      poolStatus: "active"
    });
    prismaService.poolDeposit.create.mockResolvedValue({ id: 33 });
    prismaService.poolDeposit.update.mockResolvedValue({});
    prismaService.auditEvent.create.mockResolvedValue({});
    mockWriteContract.deposit.mockResolvedValue({
      wait: jest.fn().mockResolvedValue({
        transactionHash: "0xdeposithash"
      })
    });

    const result = await service.deposit(11, "1.25", "supabase_1");

    expect(result).toEqual({
      status: "success",
      message: "Stake deposit executed successfully.",
      data: {
        transactionHash: "0xdeposithash"
      }
    });
    expect(prismaService.auditEvent.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          action: "staking.deposit.requested",
          targetType: "PoolDeposit",
          targetId: "33"
        })
      })
    );
    expect(prismaService.auditEvent.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          action: "staking.deposit.completed",
          targetType: "PoolDeposit",
          targetId: "33",
          metadata: expect.objectContaining({
            transactionHash: "0xdeposithash",
            status: "completed"
          })
        })
      })
    );
  });

  it("writes requested and failed audit events for a failed withdrawal", async () => {
    const { service, prismaService, authService } = createService();

    mockExecutableCustomer(authService);
    prismaService.stakingPool.findUnique.mockResolvedValue({
      id: 11,
      blockchainPoolId: 101,
      rewardRate: 5,
      totalStakedAmount: 0n,
      totalRewardsPaid: 0n,
      poolStatus: "active"
    });
    prismaService.poolWithdrawal.create.mockResolvedValue({ id: 44 });
    prismaService.poolWithdrawal.update.mockResolvedValue({});
    prismaService.auditEvent.create.mockResolvedValue({});
    mockReadContract.getStakedBalance.mockResolvedValue(
      createBigNumber("2000000000000000000")
    );
    mockReadContract.getPendingReward.mockResolvedValue(createBigNumber("0"));
    mockWriteContract.withdraw.mockRejectedValue(new Error("rpc down"));

    const result = await service.withdraw(11, "1.25", "supabase_1");

    expect(result).toEqual({
      status: "failed",
      message: "Failed to execute stake withdrawal."
    });
    expect(prismaService.poolWithdrawal.update).toHaveBeenCalledWith({
      where: { id: 44 },
      data: {
        status: "failed"
      }
    });
    expect(prismaService.auditEvent.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          action: "staking.withdrawal.requested",
          targetType: "PoolWithdrawal",
          targetId: "44"
        })
      })
    );
    expect(prismaService.auditEvent.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          action: "staking.withdrawal.failed",
          targetType: "PoolWithdrawal",
          targetId: "44",
          metadata: expect.objectContaining({
            errorMessage: "rpc down",
            status: "failed",
            emergency: false
          })
        })
      })
    );
  });
});
