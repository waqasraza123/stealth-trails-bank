import { Card } from "@/components/ui/card";
import { ArrowUpRight, Timer, ArrowDownRight } from "lucide-react";
import { CustomerStakingPoolSnapshot } from "@/hooks/staking/useMyStakingSnapshot";
import { formatTokenAmount } from "@/lib/customer-finance";

type StakingStatsProps = {
  pools: CustomerStakingPoolSnapshot[];
};

function sumDecimalStrings(values: string[]): string {
  const total = values.reduce((sum, value) => sum + Number(value), 0);
  return total.toString();
}

export const StakingStats = ({ pools }: StakingStatsProps) => {
  const totalStaked = sumDecimalStrings(pools.map((pool) => pool.totalStakedAmount));
  const totalRewardsPaid = sumDecimalStrings(
    pools.map((pool) => pool.totalRewardsPaid)
  );
  const averageApr =
    pools.length > 0
      ? (
          pools.reduce((sum, pool) => sum + Number(pool.rewardRate), 0) /
          pools.length
        ).toFixed(2)
      : "0.00";
  const activePoolCount = pools.filter((pool) => pool.poolStatus === "active").length;

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Card className="glass-card p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Total ETH Staked</p>
            <h3 className="text-2xl font-semibold">
              {formatTokenAmount(totalStaked, 4)} ETH
            </h3>
            <p className="text-sm text-mint-600">Across the live pool registry</p>
          </div>
          <div className="rounded-full bg-mint-100 p-2">
            <ArrowUpRight className="h-5 w-5 text-mint-700" />
          </div>
        </div>
      </Card>

      <Card className="glass-card p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Average Pool APR</p>
            <h3 className="text-2xl font-semibold">{averageApr}%</h3>
            <p className="text-sm text-mint-600">
              {activePoolCount} active pool{activePoolCount === 1 ? "" : "s"}
            </p>
          </div>
          <div className="rounded-full bg-mint-100 p-2">
            <Timer className="h-5 w-5 text-mint-700" />
          </div>
        </div>
      </Card>

      <Card className="glass-card p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Rewards Paid</p>
            <h3 className="text-2xl font-semibold">
              {formatTokenAmount(totalRewardsPaid, 4)} ETH
            </h3>
            <p className="text-sm text-mint-600">Recorded against listed pools</p>
          </div>
          <div className="rounded-full bg-mint-100 p-2">
            <ArrowDownRight className="h-5 w-5 text-mint-700" />
          </div>
        </div>
      </Card>
    </div>
  );
};
