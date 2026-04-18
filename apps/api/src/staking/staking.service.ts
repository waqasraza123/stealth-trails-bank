import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  ServiceUnavailableException
} from "@nestjs/common";
import { loadOptionalBlockchainContractWriteRuntimeConfig } from "@stealth-trails-bank/config/api";
import {
  createJsonRpcProvider,
  createStakingReadContract,
  createStakingWriteContract,
  createStakingWriteWallet,
  formatEthAmount,
  parseEthAmount
} from "@stealth-trails-bank/contracts-sdk";
import {
  AccountLifecycleStatus,
  Prisma,
  PoolStatus,
  WalletCustodyType,
  WalletStatus
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import { ethers } from "ethers";
import {
  AuthService,
  type CustomerAccountProjection,
  type CustomerWalletProjection
} from "../auth/auth.service";
import { PrismaService } from "../prisma/prisma.service";
import type { PrismaJsonValue } from "../prisma/prisma-json";
import { SolvencyService } from "../solvency/solvency.service";
import { CustomJsonResponse } from "../types/CustomJsonResponse";

type LegacyUserRecord = {
  id: number;
  ethereumAddress: string | null;
};

type CustomerStakingContext = {
  customer: CustomerAccountProjection["customer"];
  customerAccount: CustomerAccountProjection["customerAccount"];
  wallet: CustomerWalletProjection["wallet"];
  legacyUser: LegacyUserRecord | null;
};

type StakingExecutionCapability = {
  available: boolean;
  reasonCode:
    | "staking_contract_unconfigured"
    | "staking_write_unconfigured"
    | "customer_wallet_missing"
    | "customer_account_not_active"
    | "customer_wallet_not_active"
    | "wallet_custody_unsupported"
    | "signer_wallet_mismatch"
    | null;
  message: string;
};

type CustomerStakingPoolSnapshot = {
  id: number;
  blockchainPoolId: number | null;
  rewardRate: number;
  totalStakedAmount: string;
  totalRewardsPaid: string;
  poolStatus: PoolStatus;
  createdAt: string;
  updatedAt: string;
  position: {
    stakedBalance: string;
    pendingReward: string;
    canReadPosition: boolean;
  };
};

type CustomerStakingSnapshot = {
  walletAddress: string | null;
  accountStatus: AccountLifecycleStatus;
  walletStatus: WalletStatus;
  walletCustodyType: WalletCustodyType;
  readModel: {
    available: boolean;
    message: string;
  };
  execution: StakingExecutionCapability;
  pools: CustomerStakingPoolSnapshot[];
};

type StakingAuditActor = {
  actorType: "customer" | "operator";
  actorId: string;
  actorRole?: string | null;
};

export type GovernedPoolCreationExecutionInput = {
  rewardRate: number;
  operatorId: string;
  operatorRole?: string;
  stakingPoolId?: number | null;
};

export type GovernedPoolCreationExecutionResult =
  | {
      success: true;
      poolId: number;
      blockchainPoolId: number;
      transactionHash: string;
      poolStatus: PoolStatus;
    }
  | {
      success: false;
      poolId: number;
      blockchainPoolId: number;
      transactionHash: string | null;
      errorMessage: string;
    };

@Injectable()
export class StakingService {
  private readonly logger = new Logger(StakingService.name);
  private readonly provider: ethers.providers.JsonRpcProvider;
  private readonly readContract: ethers.Contract | null;
  private readonly writeWallet: ethers.Wallet | null;
  private readonly writeContract: ethers.Contract | null;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly authService: AuthService,
    @Optional()
    private readonly solvencyService?: Pick<SolvencyService, "assertStakingWritesAllowed">
  ) {
    const runtimeConfig = loadOptionalBlockchainContractWriteRuntimeConfig();

    this.provider = createJsonRpcProvider(runtimeConfig.rpcUrl);

    if (!runtimeConfig.stakingContractAddress) {
      if (runtimeConfig.environment === "production") {
        throw new Error(
          "STAKING_CONTRACT_ADDRESS is required in production when staking integration is enabled."
        );
      }

      this.readContract = null;
      this.writeWallet = null;
      this.writeContract = null;
      this.logger.warn(
        "Staking contract integration is disabled because STAKING_CONTRACT_ADDRESS is not configured."
      );
      return;
    }

    this.readContract = createStakingReadContract(
      runtimeConfig.stakingContractAddress,
      this.provider
    );

    if (!runtimeConfig.ethereumPrivateKey) {
      this.writeWallet = null;
      this.writeContract = null;
      this.logger.warn(
        "Staking write operations are disabled because ETHEREUM_PRIVATE_KEY is not configured."
      );
      return;
    }

    this.writeWallet = createStakingWriteWallet(
      runtimeConfig.ethereumPrivateKey,
      this.provider
    );
    this.writeContract = createStakingWriteContract(
      runtimeConfig.stakingContractAddress,
      this.writeWallet
    );
  }

  private describeError(error: unknown): string {
    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }

    return "Unknown staking execution error.";
  }

  private normalizeOperatorRole(operatorRole?: string): string | null {
    const normalizedOperatorRole = operatorRole?.trim().toLowerCase() ?? null;

    return normalizedOperatorRole && normalizedOperatorRole.length > 0
      ? normalizedOperatorRole
      : null;
  }

  private async writeAuditEvent(input: {
    customerId: string | null;
    actor: StakingAuditActor;
    action: string;
    targetType: string;
    targetId?: string | number | null;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.prismaService.auditEvent.create({
        data: {
          customerId: input.customerId,
          actorType: input.actor.actorType,
          actorId: input.actor.actorId,
          action: input.action,
          targetType: input.targetType,
          targetId:
            input.targetId === null || typeof input.targetId === "undefined"
              ? null
              : String(input.targetId),
          metadata: {
            ...(input.metadata ?? {}),
            actorRole: input.actor.actorRole ?? null
          } as PrismaJsonValue
        }
      });
    } catch (error) {
      this.logger.error(
        `Failed to write staking audit event "${input.action}".`,
        error instanceof Error ? error.stack : undefined
      );
    }
  }

  private requireReadContract(): ethers.Contract {
    if (!this.readContract) {
      throw new ServiceUnavailableException(
        "Staking read integration is not configured in this environment."
      );
    }

    return this.readContract;
  }

  private requireWriteContract(): ethers.Contract {
    if (!this.writeContract) {
      throw new ServiceUnavailableException(
        "Staking write integration is not configured in this environment."
      );
    }

    return this.writeContract;
  }

  private formatWeiToEth(value: ethers.BigNumberish): string {
    return formatEthAmount(value);
  }

  private formatStoredAmountToEth(value: bigint): string {
    return formatEthAmount(value.toString());
  }

  private parseEthAmount(value: string): ethers.BigNumber {
    try {
      const parsedAmount = parseEthAmount(value);

      if (parsedAmount.lte(0)) {
        throw new Error("Amount must be greater than zero.");
      }

      return parsedAmount;
    } catch {
      throw new ConflictException(
        "Amount must be a valid positive ETH value with up to 18 decimals."
      );
    }
  }

  private async getCustomerStakingContext(
    supabaseUserId: string
  ): Promise<CustomerStakingContext> {
    const [accountProjection, walletProjection, legacyUser] = await Promise.all([
      this.authService.getCustomerAccountProjectionBySupabaseUserId(
        supabaseUserId
      ),
      this.authService.getCustomerWalletProjectionBySupabaseUserId(supabaseUserId),
      this.authService.getUserFromDatabaseById(supabaseUserId)
    ]);

    return {
      customer: accountProjection.customer,
      customerAccount: accountProjection.customerAccount,
      wallet: walletProjection.wallet,
      legacyUser: legacyUser
        ? {
            id: legacyUser.id,
            ethereumAddress: legacyUser.ethereumAddress
          }
        : null
    };
  }

  private resolveReadModelAvailability(
    context: CustomerStakingContext
  ): { available: boolean; message: string } {
    if (!this.readContract) {
      return {
        available: false,
        message:
          "Live staking contract reads are unavailable because the staking contract is not configured."
      };
    }

    if (!context.wallet.address) {
      return {
        available: false,
        message:
          "Live customer staking positions are unavailable because no managed wallet address is linked to this account."
      };
    }

    return {
      available: true,
      message:
        "Live customer staking positions are being read from the configured staking contract."
    };
  }

  private resolveExecutionCapability(
    context: CustomerStakingContext
  ): StakingExecutionCapability {
    if (!this.readContract) {
      return {
        available: false,
        reasonCode: "staking_contract_unconfigured",
        message:
          "Customer staking execution is disabled because the staking contract is not configured."
      };
    }

    if (!this.writeContract || !this.writeWallet) {
      return {
        available: false,
        reasonCode: "staking_write_unconfigured",
        message:
          "Customer staking execution is disabled because staking write credentials are not configured."
      };
    }

    if (!context.wallet.address) {
      return {
        available: false,
        reasonCode: "customer_wallet_missing",
        message:
          "Customer staking execution is disabled because no managed wallet is linked to this account."
      };
    }

    if (context.customerAccount.status !== AccountLifecycleStatus.active) {
      return {
        available: false,
        reasonCode: "customer_account_not_active",
        message:
          "Customer staking execution is only allowed for active customer accounts."
      };
    }

    if (context.wallet.status !== WalletStatus.active) {
      return {
        available: false,
        reasonCode: "customer_wallet_not_active",
        message:
          "Customer staking execution is only allowed for active managed wallets."
      };
    }

    if (context.wallet.custodyType !== WalletCustodyType.platform_managed) {
      return {
        available: false,
        reasonCode: "wallet_custody_unsupported",
        message:
          "Customer staking execution only supports platform-managed wallets."
      };
    }

    if (
      context.wallet.address.toLowerCase() !==
      this.writeWallet.address.toLowerCase()
    ) {
      return {
        available: false,
        reasonCode: "signer_wallet_mismatch",
        message:
          "Customer staking execution is disabled because contract positions are keyed by the signing wallet, and the configured signer does not match this customer's managed wallet."
      };
    }

    return {
      available: true,
      reasonCode: null,
      message:
        "Customer staking execution is enabled for this managed wallet."
    };
  }

  private async getPoolOrThrow(poolId: number) {
    const pool = await this.prismaService.stakingPool.findUnique({
      where: { id: poolId }
    });

    if (!pool) {
      throw new NotFoundException(`Staking pool with ID ${poolId} not found.`);
    }

    if (pool.blockchainPoolId === null) {
      throw new ConflictException(
        "Staking pool is not linked to a blockchain pool yet."
      );
    }

    return pool;
  }

  private async getCustomerPositionOrThrow(
    context: CustomerStakingContext,
    poolId: number
  ) {
    if (!context.wallet.address) {
      throw new ConflictException("Managed wallet address is required.");
    }

    const readContract = this.requireReadContract();
    const pool = await this.getPoolOrThrow(poolId);
    const blockchainPoolId = pool.blockchainPoolId as number;

    const [stakedBalance, pendingReward] = await Promise.all([
      readContract.getStakedBalance(context.wallet.address, blockchainPoolId),
      readContract.getPendingReward(context.wallet.address, blockchainPoolId)
    ]);

    return {
      pool,
      stakedBalance,
      pendingReward
    };
  }

  private assertPoolAllowsDeposit(poolStatus: PoolStatus): void {
    if (poolStatus !== PoolStatus.active) {
      throw new ConflictException(
        "Deposits are only allowed for active staking pools."
      );
    }
  }

  private assertPoolAllowsStandardExit(poolStatus: PoolStatus): void {
    if (poolStatus !== PoolStatus.active && poolStatus !== PoolStatus.paused) {
      throw new ConflictException(
        "Withdrawals and reward claims are only allowed for active or paused staking pools."
      );
    }
  }

  private async createPendingDepositRecord(
    userId: number,
    poolId: number,
    amount: ethers.BigNumber
  ) {
    return this.prismaService.poolDeposit.create({
      data: {
        userId,
        stakingPoolId: poolId,
        amountStaked: BigInt(amount.toString()),
        transactionHash: `pending_deposit_${randomUUID()}`,
        status: "pending"
      }
    });
  }

  private async createPendingWithdrawalRecord(
    userId: number,
    poolId: number,
    amount: ethers.BigNumber
  ) {
    return this.prismaService.poolWithdrawal.create({
      data: {
        userId,
        stakingPoolId: poolId,
        amountWithdrawn: BigInt(amount.toString()),
        transactionHash: `pending_withdrawal_${randomUUID()}`,
        status: "pending"
      }
    });
  }

  async executeGovernedPoolCreation(
    input: GovernedPoolCreationExecutionInput
  ): Promise<GovernedPoolCreationExecutionResult> {
    const normalizedOperatorRole = this.normalizeOperatorRole(input.operatorRole);
    const writeContract = this.requireWriteContract();
    const actor: StakingAuditActor = {
      actorType: "operator",
      actorId: input.operatorId,
      actorRole: normalizedOperatorRole
    };
    let stakingPool = input.stakingPoolId
      ? await this.prismaService.stakingPool.findUnique({
          where: {
            id: input.stakingPoolId
          }
        })
      : null;

    if (input.stakingPoolId && !stakingPool) {
      throw new NotFoundException(
        `Staking pool with ID ${input.stakingPoolId} was not found for governance execution.`
      );
    }

    if (stakingPool && stakingPool.rewardRate !== input.rewardRate) {
      throw new ConflictException(
        "Governance request reward rate no longer matches the linked staking pool."
      );
    }

    if (!stakingPool) {
      const createdStakingPool = await this.prismaService.stakingPool.create({
        data: {
          rewardRate: input.rewardRate,
          totalStakedAmount: 0n,
          totalRewardsPaid: 0n,
          poolStatus: PoolStatus.paused
        }
      });

      stakingPool = await this.prismaService.stakingPool.update({
        where: {
          id: createdStakingPool.id
        },
        data: {
          blockchainPoolId: createdStakingPool.id
        }
      });
    } else if (stakingPool.blockchainPoolId === null) {
      stakingPool = await this.prismaService.stakingPool.update({
        where: {
          id: stakingPool.id
        },
        data: {
          blockchainPoolId: stakingPool.id
        }
      });
    }

    let transactionHash: string | null = null;

    try {
      const blockchainPoolId = stakingPool.blockchainPoolId as number;
      const transaction = await writeContract.createPool(
        input.rewardRate,
        blockchainPoolId
      );
      transactionHash =
        typeof transaction?.hash === "string" ? transaction.hash : null;
      const receipt = await transaction.wait();
      transactionHash =
        typeof receipt?.transactionHash === "string"
          ? receipt.transactionHash
          : transactionHash;

      await this.writeAuditEvent({
        customerId: null,
        actor,
        action: "staking.pool.executed",
        targetType: "StakingPool",
        targetId: stakingPool.id,
        metadata: {
          rewardRate: input.rewardRate,
          poolStatus: stakingPool.poolStatus,
          blockchainPoolId: stakingPool.blockchainPoolId,
          transactionHash
        }
      });

      return {
        success: true,
        poolId: stakingPool.id,
        blockchainPoolId,
        transactionHash: transactionHash ?? "",
        poolStatus: stakingPool.poolStatus
      };
    } catch (error) {
      await this.writeAuditEvent({
        customerId: null,
        actor,
        action: "staking.pool.execution_failed",
        targetType: "StakingPool",
        targetId: stakingPool.id,
        metadata: {
          rewardRate: input.rewardRate,
          blockchainPoolId: stakingPool.blockchainPoolId,
          transactionHash,
          errorMessage: this.describeError(error)
        }
      });

      this.logger.error(
        "Failed to execute staking pool creation.",
        error instanceof Error ? error.stack : undefined
      );

      return {
        success: false,
        poolId: stakingPool.id,
        blockchainPoolId: stakingPool.blockchainPoolId as number,
        transactionHash,
        errorMessage: this.describeError(error)
      };
    }
  }

  async getMySnapshot(
    supabaseUserId: string
  ): Promise<CustomJsonResponse<CustomerStakingSnapshot>> {
    const context = await this.getCustomerStakingContext(supabaseUserId);
    const pools = await this.prismaService.stakingPool.findMany({
      orderBy: {
        createdAt: "desc"
      }
    });
    const readModel = this.resolveReadModelAvailability(context);
    const execution = this.resolveExecutionCapability(context);

    const poolSnapshots = await Promise.all(
      pools.map(async (pool): Promise<CustomerStakingPoolSnapshot> => {
        let totalStakedAmount = this.formatStoredAmountToEth(pool.totalStakedAmount);
        let positionStakedBalance = "0.0";
        let positionPendingReward = "0.0";
        let canReadPosition = false;

        if (readModel.available && pool.blockchainPoolId !== null && context.wallet.address) {
          try {
            const readContract = this.requireReadContract();
            const [totalStaked, stakedBalance, pendingReward] = await Promise.all([
              readContract.getTotalStaked(pool.blockchainPoolId),
              readContract.getStakedBalance(context.wallet.address, pool.blockchainPoolId),
              readContract.getPendingReward(context.wallet.address, pool.blockchainPoolId)
            ]);

            totalStakedAmount = this.formatWeiToEth(totalStaked);
            positionStakedBalance = this.formatWeiToEth(stakedBalance);
            positionPendingReward = this.formatWeiToEth(pendingReward);
            canReadPosition = true;
          } catch (error) {
            this.logger.warn(
              `Failed to read staking position for customer ${supabaseUserId} on pool ${pool.id}.`
            );
          }
        }

        return {
          id: pool.id,
          blockchainPoolId: pool.blockchainPoolId,
          rewardRate: pool.rewardRate,
          totalStakedAmount,
          totalRewardsPaid: this.formatStoredAmountToEth(pool.totalRewardsPaid),
          poolStatus: pool.poolStatus,
          createdAt: pool.createdAt.toISOString(),
          updatedAt: pool.updatedAt.toISOString(),
          position: {
            stakedBalance: positionStakedBalance,
            pendingReward: positionPendingReward,
            canReadPosition
          }
        };
      })
    );

    return {
      status: "success",
      message: "Customer staking snapshot retrieved successfully.",
      data: {
        walletAddress: context.wallet.address,
        accountStatus: context.customerAccount.status,
        walletStatus: context.wallet.status,
        walletCustodyType: context.wallet.custodyType,
        readModel,
        execution,
        pools: poolSnapshots
      }
    };
  }

  async deposit(
    poolId: number,
    amount: string,
    supabaseUserId: string
  ): Promise<CustomJsonResponse> {
    await this.solvencyService?.assertStakingWritesAllowed?.();
    const context = await this.getCustomerStakingContext(supabaseUserId);
    const actor: StakingAuditActor = {
      actorType: "customer",
      actorId: supabaseUserId
    };
    const execution = this.resolveExecutionCapability(context);

    if (!execution.available) {
      return {
        status: "failed",
        message: execution.message
      };
    }

    if (!context.legacyUser) {
      throw new NotFoundException("Legacy customer user profile not found.");
    }

    const parsedAmount = this.parseEthAmount(amount);
    const pool = await this.getPoolOrThrow(poolId);
    this.assertPoolAllowsDeposit(pool.poolStatus);

    const writeContract = this.requireWriteContract();
    const depositRecord = await this.createPendingDepositRecord(
      context.legacyUser.id,
      pool.id,
      parsedAmount
    );

    await this.writeAuditEvent({
      customerId: context.customer.id,
      actor,
      action: "staking.deposit.requested",
      targetType: "PoolDeposit",
      targetId: depositRecord.id,
      metadata: {
        customerAccountId: context.customerAccount.id,
        walletId: context.wallet.id,
        walletAddress: context.wallet.address,
        stakingPoolId: pool.id,
        blockchainPoolId: pool.blockchainPoolId,
        requestedAmount: parsedAmount.toString(),
        status: "pending"
      }
    });

    try {
      const transaction = await writeContract.deposit(
        pool.blockchainPoolId,
        parsedAmount,
        { value: parsedAmount }
      );
      const receipt = await transaction.wait();

      await this.prismaService.poolDeposit.update({
        where: { id: depositRecord.id },
        data: {
          transactionHash: receipt.transactionHash,
          status: "completed"
        }
      });

      await this.writeAuditEvent({
        customerId: context.customer.id,
        actor,
        action: "staking.deposit.completed",
        targetType: "PoolDeposit",
        targetId: depositRecord.id,
        metadata: {
          customerAccountId: context.customerAccount.id,
          walletId: context.wallet.id,
          walletAddress: context.wallet.address,
          stakingPoolId: pool.id,
          blockchainPoolId: pool.blockchainPoolId,
          requestedAmount: parsedAmount.toString(),
          status: "completed",
          transactionHash: receipt.transactionHash
        }
      });

      return {
        status: "success",
        message: "Stake deposit executed successfully.",
        data: {
          transactionHash: receipt.transactionHash
        }
      };
    } catch (error) {
      await this.prismaService.poolDeposit.update({
        where: { id: depositRecord.id },
        data: {
          status: "failed"
        }
      });

      await this.writeAuditEvent({
        customerId: context.customer.id,
        actor,
        action: "staking.deposit.failed",
        targetType: "PoolDeposit",
        targetId: depositRecord.id,
        metadata: {
          customerAccountId: context.customerAccount.id,
          walletId: context.wallet.id,
          walletAddress: context.wallet.address,
          stakingPoolId: pool.id,
          blockchainPoolId: pool.blockchainPoolId,
          requestedAmount: parsedAmount.toString(),
          status: "failed",
          errorMessage: this.describeError(error)
        }
      });

      this.logger.error("Failed to execute staking deposit.", error);
      return {
        status: "failed",
        message: "Failed to execute stake deposit."
      };
    }
  }

  async withdraw(
    poolId: number,
    amount: string,
    supabaseUserId: string
  ): Promise<CustomJsonResponse> {
    await this.solvencyService?.assertStakingWritesAllowed?.();
    const context = await this.getCustomerStakingContext(supabaseUserId);
    const actor: StakingAuditActor = {
      actorType: "customer",
      actorId: supabaseUserId
    };
    const execution = this.resolveExecutionCapability(context);

    if (!execution.available) {
      return {
        status: "failed",
        message: execution.message
      };
    }

    if (!context.legacyUser) {
      throw new NotFoundException("Legacy customer user profile not found.");
    }

    const parsedAmount = this.parseEthAmount(amount);
    const { pool, stakedBalance } = await this.getCustomerPositionOrThrow(
      context,
      poolId
    );
    this.assertPoolAllowsStandardExit(pool.poolStatus);

    if (stakedBalance.lt(parsedAmount)) {
      throw new ConflictException(
        "Withdrawal amount exceeds the customer's live staked balance."
      );
    }

    const writeContract = this.requireWriteContract();
    const withdrawalRecord = await this.createPendingWithdrawalRecord(
      context.legacyUser.id,
      pool.id,
      parsedAmount
    );

    await this.writeAuditEvent({
      customerId: context.customer.id,
      actor,
      action: "staking.withdrawal.requested",
      targetType: "PoolWithdrawal",
      targetId: withdrawalRecord.id,
      metadata: {
        customerAccountId: context.customerAccount.id,
        walletId: context.wallet.id,
        walletAddress: context.wallet.address,
        stakingPoolId: pool.id,
        blockchainPoolId: pool.blockchainPoolId,
        requestedAmount: parsedAmount.toString(),
        status: "pending",
        emergency: false
      }
    });

    try {
      const transaction = await writeContract.withdraw(
        pool.blockchainPoolId,
        parsedAmount
      );
      const receipt = await transaction.wait();

      await this.prismaService.poolWithdrawal.update({
        where: { id: withdrawalRecord.id },
        data: {
          transactionHash: receipt.transactionHash,
          status: "completed"
        }
      });

      await this.writeAuditEvent({
        customerId: context.customer.id,
        actor,
        action: "staking.withdrawal.completed",
        targetType: "PoolWithdrawal",
        targetId: withdrawalRecord.id,
        metadata: {
          customerAccountId: context.customerAccount.id,
          walletId: context.wallet.id,
          walletAddress: context.wallet.address,
          stakingPoolId: pool.id,
          blockchainPoolId: pool.blockchainPoolId,
          requestedAmount: parsedAmount.toString(),
          status: "completed",
          emergency: false,
          transactionHash: receipt.transactionHash
        }
      });

      return {
        status: "success",
        message: "Stake withdrawal executed successfully.",
        data: {
          transactionHash: receipt.transactionHash
        }
      };
    } catch (error) {
      await this.prismaService.poolWithdrawal.update({
        where: { id: withdrawalRecord.id },
        data: {
          status: "failed"
        }
      });

      await this.writeAuditEvent({
        customerId: context.customer.id,
        actor,
        action: "staking.withdrawal.failed",
        targetType: "PoolWithdrawal",
        targetId: withdrawalRecord.id,
        metadata: {
          customerAccountId: context.customerAccount.id,
          walletId: context.wallet.id,
          walletAddress: context.wallet.address,
          stakingPoolId: pool.id,
          blockchainPoolId: pool.blockchainPoolId,
          requestedAmount: parsedAmount.toString(),
          status: "failed",
          emergency: false,
          errorMessage: this.describeError(error)
        }
      });

      this.logger.error("Failed to execute staking withdrawal.", error);
      return {
        status: "failed",
        message: "Failed to execute stake withdrawal."
      };
    }
  }

  async claimReward(
    poolId: number,
    supabaseUserId: string
  ): Promise<CustomJsonResponse> {
    await this.solvencyService?.assertStakingWritesAllowed?.();
    const context = await this.getCustomerStakingContext(supabaseUserId);
    const actor: StakingAuditActor = {
      actorType: "customer",
      actorId: supabaseUserId
    };
    const execution = this.resolveExecutionCapability(context);

    if (!execution.available) {
      return {
        status: "failed",
        message: execution.message
      };
    }

    const { pool, pendingReward } = await this.getCustomerPositionOrThrow(
      context,
      poolId
    );
    this.assertPoolAllowsStandardExit(pool.poolStatus);

    if (pendingReward.lte(0)) {
      throw new ConflictException("No live staking rewards are available to claim.");
    }

    try {
      const transaction = await this.requireWriteContract().claimReward(
        pool.blockchainPoolId
      );
      const receipt = await transaction.wait();

      await this.writeAuditEvent({
        customerId: context.customer.id,
        actor,
        action: "staking.reward_claim.completed",
        targetType: "StakingPool",
        targetId: pool.id,
        metadata: {
          customerAccountId: context.customerAccount.id,
          walletId: context.wallet.id,
          walletAddress: context.wallet.address,
          stakingPoolId: pool.id,
          blockchainPoolId: pool.blockchainPoolId,
          pendingReward: pendingReward.toString(),
          transactionHash: receipt.transactionHash
        }
      });

      return {
        status: "success",
        message: "Stake reward claimed successfully.",
        data: {
          transactionHash: receipt.transactionHash
        }
      };
    } catch (error) {
      await this.writeAuditEvent({
        customerId: context.customer.id,
        actor,
        action: "staking.reward_claim.failed",
        targetType: "StakingPool",
        targetId: pool.id,
        metadata: {
          customerAccountId: context.customerAccount.id,
          walletId: context.wallet.id,
          walletAddress: context.wallet.address,
          stakingPoolId: pool.id,
          blockchainPoolId: pool.blockchainPoolId,
          pendingReward: pendingReward.toString(),
          errorMessage: this.describeError(error)
        }
      });
      this.logger.error("Failed to claim staking reward.", error);
      return {
        status: "failed",
        message: "Failed to claim staking reward."
      };
    }
  }

  async emergencyWithdraw(
    poolId: number,
    supabaseUserId: string
  ): Promise<CustomJsonResponse> {
    await this.solvencyService?.assertStakingWritesAllowed?.();
    const context = await this.getCustomerStakingContext(supabaseUserId);
    const actor: StakingAuditActor = {
      actorType: "customer",
      actorId: supabaseUserId
    };
    const execution = this.resolveExecutionCapability(context);

    if (!execution.available) {
      return {
        status: "failed",
        message: execution.message
      };
    }

    if (!context.legacyUser) {
      throw new NotFoundException("Legacy customer user profile not found.");
    }

    const { pool, stakedBalance } = await this.getCustomerPositionOrThrow(
      context,
      poolId
    );

    if (stakedBalance.lte(0)) {
      throw new ConflictException(
        "No live staked balance is available for emergency withdrawal."
      );
    }

    const withdrawalRecord = await this.createPendingWithdrawalRecord(
      context.legacyUser.id,
      pool.id,
      stakedBalance
    );

    await this.writeAuditEvent({
      customerId: context.customer.id,
      actor,
      action: "staking.emergency_withdrawal.requested",
      targetType: "PoolWithdrawal",
      targetId: withdrawalRecord.id,
      metadata: {
        customerAccountId: context.customerAccount.id,
        walletId: context.wallet.id,
        walletAddress: context.wallet.address,
        stakingPoolId: pool.id,
        blockchainPoolId: pool.blockchainPoolId,
        requestedAmount: stakedBalance.toString(),
        status: "pending",
        emergency: true
      }
    });

    try {
      const transaction = await this.requireWriteContract().emergencyWithdraw(
        pool.blockchainPoolId
      );
      const receipt = await transaction.wait();

      await this.prismaService.poolWithdrawal.update({
        where: { id: withdrawalRecord.id },
        data: {
          transactionHash: receipt.transactionHash,
          status: "completed"
        }
      });

      await this.writeAuditEvent({
        customerId: context.customer.id,
        actor,
        action: "staking.emergency_withdrawal.completed",
        targetType: "PoolWithdrawal",
        targetId: withdrawalRecord.id,
        metadata: {
          customerAccountId: context.customerAccount.id,
          walletId: context.wallet.id,
          walletAddress: context.wallet.address,
          stakingPoolId: pool.id,
          blockchainPoolId: pool.blockchainPoolId,
          requestedAmount: stakedBalance.toString(),
          status: "completed",
          emergency: true,
          transactionHash: receipt.transactionHash
        }
      });

      return {
        status: "success",
        message: "Emergency stake withdrawal executed successfully.",
        data: {
          transactionHash: receipt.transactionHash
        }
      };
    } catch (error) {
      await this.prismaService.poolWithdrawal.update({
        where: { id: withdrawalRecord.id },
        data: {
          status: "failed"
        }
      });

      await this.writeAuditEvent({
        customerId: context.customer.id,
        actor,
        action: "staking.emergency_withdrawal.failed",
        targetType: "PoolWithdrawal",
        targetId: withdrawalRecord.id,
        metadata: {
          customerAccountId: context.customerAccount.id,
          walletId: context.wallet.id,
          walletAddress: context.wallet.address,
          stakingPoolId: pool.id,
          blockchainPoolId: pool.blockchainPoolId,
          requestedAmount: stakedBalance.toString(),
          status: "failed",
          emergency: true,
          errorMessage: this.describeError(error)
        }
      });

      this.logger.error("Failed to execute emergency staking withdrawal.", error);
      return {
        status: "failed",
        message: "Failed to execute emergency stake withdrawal."
      };
    }
  }

  async getStakedBalance(
    supabaseUserId: string,
    poolId: number
  ): Promise<CustomJsonResponse<{ balance: string }>> {
    const context = await this.getCustomerStakingContext(supabaseUserId);
    const { stakedBalance } = await this.getCustomerPositionOrThrow(context, poolId);

    return {
      status: "success",
      message: "Staked balance retrieved successfully.",
      data: {
        balance: this.formatWeiToEth(stakedBalance)
      }
    };
  }

  async getPendingReward(
    supabaseUserId: string,
    poolId: number
  ): Promise<CustomJsonResponse<{ reward: string }>> {
    const context = await this.getCustomerStakingContext(supabaseUserId);
    const { pendingReward } = await this.getCustomerPositionOrThrow(context, poolId);

    return {
      status: "success",
      message: "Pending reward retrieved successfully.",
      data: {
        reward: this.formatWeiToEth(pendingReward)
      }
    };
  }

  async getTotalStaked(
    poolId: number
  ): Promise<CustomJsonResponse<{ totalStaked: string }>> {
    const readContract = this.requireReadContract();
    const pool = await this.getPoolOrThrow(poolId);
    const totalStaked = await readContract.getTotalStaked(pool.blockchainPoolId);

    return {
      status: "success",
      message: "Total staked amount retrieved successfully.",
      data: {
        totalStaked: this.formatWeiToEth(totalStaked)
      }
    };
  }
}
