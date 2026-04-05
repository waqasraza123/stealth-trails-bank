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
      parseEther: jest.fn()
    }
  }
}));

import { StakingService } from "./staking.service";

describe("StakingService", () => {
  function createService() {
    const prismaService = {
      stakingPool: {
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
      }
    };

    const authService = {
      getCustomerAccountProjectionBySupabaseUserId: jest.fn(),
      getCustomerWalletProjectionBySupabaseUserId: jest.fn(),
      getUserFromDatabaseById: jest.fn()
    };

    const service = new StakingService(
      prismaService as never,
      authService as never
    );

    return {
      service,
      prismaService,
      authService
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

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
});
