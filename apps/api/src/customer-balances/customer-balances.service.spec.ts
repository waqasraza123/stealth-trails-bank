import { NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { CustomerBalancesService } from "./customer-balances.service";

function createService() {
  const prismaService = {
    customerAccount: {
      findFirst: jest.fn()
    },
    customerAssetBalance: {
      findMany: jest.fn()
    }
  };

  const service = new CustomerBalancesService(prismaService as never);

  return {
    service,
    prismaService
  };
}

describe("CustomerBalancesService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns ledger-backed balances for the authenticated customer", async () => {
    const { service, prismaService } = createService();

    prismaService.customerAccount.findFirst.mockResolvedValue({
      id: "account_1"
    });

    prismaService.customerAssetBalance.findMany.mockResolvedValue([
      {
        id: "balance_1",
        customerAccountId: "account_1",
        assetId: "asset_1",
        availableBalance: new Prisma.Decimal("10.50"),
        pendingBalance: new Prisma.Decimal("0"),
        updatedAt: new Date("2026-04-01T10:00:00.000Z"),
        asset: {
          id: "asset_1",
          symbol: "ETH",
          displayName: "Ether",
          decimals: 18,
          chainId: 8453
        }
      }
    ]);

    const result = await service.listMyBalances("supabase_1");

    expect(result.customerAccountId).toBe("account_1");
    expect(result.balances).toHaveLength(1);
    expect(result.balances[0].availableBalance).toBe("10.50");
  });

  it("fails when the customer account projection does not exist", async () => {
    const { service, prismaService } = createService();

    prismaService.customerAccount.findFirst.mockResolvedValue(null);

    await expect(
      service.listMyBalances("missing_user")
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
