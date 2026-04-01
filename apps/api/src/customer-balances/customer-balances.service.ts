import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

type CustomerAssetBalanceProjection = {
  asset: {
    id: string;
    symbol: string;
    displayName: string;
    decimals: number;
    chainId: number;
  };
  availableBalance: string;
  pendingBalance: string;
  updatedAt: string;
};

type MyCustomerBalancesResult = {
  customerAccountId: string;
  balances: CustomerAssetBalanceProjection[];
};

@Injectable()
export class CustomerBalancesService {
  constructor(private readonly prismaService: PrismaService) {}

  async listMyBalances(
    supabaseUserId: string
  ): Promise<MyCustomerBalancesResult> {
    const customerAccount = await this.prismaService.customerAccount.findFirst({
      where: {
        customer: {
          supabaseUserId
        }
      },
      select: {
        id: true
      }
    });

    if (!customerAccount) {
      throw new NotFoundException("Customer account projection not found.");
    }

    const balances = await this.prismaService.customerAssetBalance.findMany({
      where: {
        customerAccountId: customerAccount.id
      },
      orderBy: {
        asset: {
          symbol: "asc"
        }
      },
      include: {
        asset: {
          select: {
            id: true,
            symbol: true,
            displayName: true,
            decimals: true,
            chainId: true
          }
        }
      }
    });

    return {
      customerAccountId: customerAccount.id,
      balances: balances.map((balance) => ({
        asset: {
          id: balance.asset.id,
          symbol: balance.asset.symbol,
          displayName: balance.asset.displayName,
          decimals: balance.asset.decimals,
          chainId: balance.asset.chainId
        },
        availableBalance: balance.availableBalance.toString(),
        pendingBalance: balance.pendingBalance.toString(),
        updatedAt: balance.updatedAt.toISOString()
      }))
    };
  }
}
