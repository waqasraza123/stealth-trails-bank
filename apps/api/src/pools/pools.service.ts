import { Injectable } from "@nestjs/common";
import { PoolStatus, StakingPool } from "@prisma/client";
import { ethers } from "ethers";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class PoolsService {
    constructor(private readonly prismaService: PrismaService) { }

    private formatStoredAmountToEth(value: bigint): string {
        return ethers.utils.formatEther(value.toString());
    }

    async getPools(status?: string): Promise<any[]> {
        const filters: { poolStatus?: PoolStatus } = {};
        if (status) {
            filters.poolStatus = status as PoolStatus;
        }

        const pools = await this.prismaService.stakingPool.findMany({
            where: filters,
            orderBy: {
                createdAt: 'desc',
            },
        });

        return pools.map(pool => ({
            ...pool,
            totalStakedAmount: this.formatStoredAmountToEth(pool.totalStakedAmount),
            totalRewardsPaid: this.formatStoredAmountToEth(pool.totalRewardsPaid),
        }));
    }

    async getPoolById(poolId: number): Promise<Record<string, unknown> | null> {
        const pool = await this.prismaService.stakingPool.findUnique({
            where: {
                id: poolId,
            },
        });

        if (!pool) {
            return null;
        }

        return {
            ...pool,
            totalStakedAmount: this.formatStoredAmountToEth(pool.totalStakedAmount),
            totalRewardsPaid: this.formatStoredAmountToEth(pool.totalRewardsPaid),
        };
    }

    async createPool(rewardRate: number): Promise<StakingPool> {
        return this.prismaService.stakingPool.create({
            data: {
                rewardRate,
                totalStakedAmount: 0n,
                totalRewardsPaid: 0n,
                poolStatus: PoolStatus.disabled,
            },
        });
    }

    async updatePoolStatus(poolId: number, status: PoolStatus): Promise<StakingPool> {
        return this.prismaService.stakingPool.update({
            where: {
                id: poolId,
            },
            data: {
                poolStatus: status,
            },
        });
    }

}
