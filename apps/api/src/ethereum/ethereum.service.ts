import { Injectable, OnModuleInit } from "@nestjs/common";
import { loadBlockchainContractReadRuntimeConfig } from "@stealth-trails-bank/config/api";
import { ethers } from "ethers";
import { PrismaService } from "../prisma/prisma.service";

const stakingEventAbi = [
  "event PoolCreated(uint256 poolId, uint256 rewardRate, uint256 externalPoolId)",
  "event Deposited(address indexed user, uint256 poolId, uint256 amount)"
];

@Injectable()
export class EthereumService implements OnModuleInit {
  private readonly provider: ethers.providers.JsonRpcProvider;
  private readonly stakingContract: ethers.Contract;

  constructor(private readonly prismaService: PrismaService) {
    const runtimeConfig = loadBlockchainContractReadRuntimeConfig();

    this.provider = new ethers.providers.JsonRpcProvider(
      runtimeConfig.rpcUrl
    );
    this.stakingContract = new ethers.Contract(
      runtimeConfig.stakingContractAddress,
      stakingEventAbi,
      this.provider
    );
  }

  onModuleInit(): void {
    this.listenToEvents();
  }

  private listenToEvents(): void {
    this.stakingContract.on(
      "PoolCreated",
      async (
        poolId: ethers.BigNumber,
        _rewardRate: ethers.BigNumber,
        externalPoolId: ethers.BigNumber
      ) => {
        await this.prismaService.stakingPool.update({
          where: {
            id: externalPoolId.toNumber()
          },
          data: {
            blockchainPoolId: poolId.toNumber()
          }
        });
      }
    );

    this.stakingContract.on(
      "Deposited",
      (
        user: string,
        poolId: ethers.BigNumber,
        amount: ethers.BigNumber
      ) => {
        console.log("Deposited event received", {
          user,
          poolId: poolId.toNumber(),
          amount: amount.toString()
        });
      }
    );
  }
}
