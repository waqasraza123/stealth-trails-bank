import { Injectable } from "@nestjs/common";
import { loadProductChainRuntimeConfig } from "@stealth-trails-bank/config/api";
import { AssetStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

type SupportedAssetProjection = {
  id: string;
  symbol: string;
  displayName: string;
  decimals: number;
  chainId: number;
  assetType: string;
  contractAddress: string | null;
};

type ListSupportedAssetsResult = {
  assets: SupportedAssetProjection[];
};

@Injectable()
export class SupportedAssetsService {
  private readonly productChainId: number;

  constructor(private readonly prismaService: PrismaService) {
    this.productChainId = loadProductChainRuntimeConfig().productChainId;
  }

  async listSupportedAssets(): Promise<ListSupportedAssetsResult> {
    const assets = await this.prismaService.asset.findMany({
      where: {
        chainId: this.productChainId,
        status: AssetStatus.active
      },
      orderBy: {
        symbol: "asc"
      },
      select: {
        id: true,
        symbol: true,
        displayName: true,
        decimals: true,
        chainId: true,
        assetType: true,
        contractAddress: true
      }
    });

    return {
      assets: assets.map((asset) => ({
        id: asset.id,
        symbol: asset.symbol,
        displayName: asset.displayName,
        decimals: asset.decimals,
        chainId: asset.chainId,
        assetType: asset.assetType,
        contractAddress: asset.contractAddress
      }))
    };
  }
}
