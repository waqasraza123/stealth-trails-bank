jest.mock("@stealth-trails-bank/config/api", () => ({
  loadProductChainRuntimeConfig: () => ({
    productChainId: 8453
  })
}));

import { SupportedAssetsService } from "./supported-assets.service";

function createService() {
  const prismaService = {
    asset: {
      findMany: jest.fn()
    }
  };

  const service = new SupportedAssetsService(prismaService as never);

  return {
    service,
    prismaService
  };
}

describe("SupportedAssetsService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns active supported assets for the configured product chain", async () => {
    const { service, prismaService } = createService();

    prismaService.asset.findMany.mockResolvedValue([
      {
        id: "asset_eth",
        symbol: "ETH",
        displayName: "Ether",
        decimals: 18,
        chainId: 8453,
        assetType: "native",
        contractAddress: null
      },
      {
        id: "asset_usdc",
        symbol: "USDC",
        displayName: "USD Coin",
        decimals: 6,
        chainId: 8453,
        assetType: "erc20",
        contractAddress: "0x0000000000000000000000000000000000000abc"
      }
    ]);

    const result = await service.listSupportedAssets();

    expect(prismaService.asset.findMany).toHaveBeenCalledWith({
      where: {
        chainId: 8453,
        status: "active"
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

    expect(result.assets).toEqual([
      {
        id: "asset_eth",
        symbol: "ETH",
        displayName: "Ether",
        decimals: 18,
        chainId: 8453,
        assetType: "native",
        contractAddress: null
      },
      {
        id: "asset_usdc",
        symbol: "USDC",
        displayName: "USD Coin",
        decimals: 6,
        chainId: 8453,
        assetType: "erc20",
        contractAddress: "0x0000000000000000000000000000000000000abc"
      }
    ]);
  });
});
