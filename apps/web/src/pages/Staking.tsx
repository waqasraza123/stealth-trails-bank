import { useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Clock3,
  Database,
  ShieldAlert,
  Wallet
} from "lucide-react";
import { Layout } from "@/components/Layout";
import { StakingStats } from "@/components/staking/StakingStats";
import { PoolCard } from "@/components/staking/PoolCard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  type CustomerStakingPoolSnapshot,
  useClaimStakeReward,
  useEmergencyStakeWithdrawal,
  useMyStakingSnapshot,
  useStakeDeposit,
  useStakeWithdrawal
} from "@/hooks/staking/useMyStakingSnapshot";
import {
  formatDateLabel,
  formatShortAddress,
  formatTokenAmount,
  isPositiveDecimalString
} from "@/lib/customer-finance";
import { useUserStore } from "@/stores/userStore";

const Staking = () => {
  const [selectedPoolId, setSelectedPoolId] = useState<number | null>(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const { toast } = useToast();
  const stakingQuery = useMyStakingSnapshot();
  const depositMutation = useStakeDeposit();
  const withdrawalMutation = useStakeWithdrawal();
  const claimRewardMutation = useClaimStakeReward();
  const emergencyWithdrawalMutation = useEmergencyStakeWithdrawal();
  const user = useUserStore((state) => state.user);
  const snapshot = stakingQuery.data;
  const pools = snapshot?.pools ?? [];
  const selectedPool =
    pools.find((pool) => pool.id === selectedPoolId) ?? pools[0] ?? null;
  const executionEnabled = snapshot?.execution.available ?? false;
  const executionMessage =
    snapshot?.execution.message ??
    "Customer staking execution availability is loading.";
  const executionPending =
    depositMutation.isPending ||
    withdrawalMutation.isPending ||
    claimRewardMutation.isPending ||
    emergencyWithdrawalMutation.isPending;

  async function handleDeposit(pool: CustomerStakingPoolSnapshot) {
    if (!isPositiveDecimalString(depositAmount)) {
      toast({
        variant: "destructive",
        title: "Invalid stake amount",
        description: "Enter a positive ETH amount to stake."
      });
      return;
    }

    try {
      const result = await depositMutation.mutateAsync({
        poolId: pool.id,
        amount: depositAmount
      });
      setDepositAmount("");
      toast({
        title: "Stake deposit submitted",
        description: `Transaction hash: ${result.transactionHash}`
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Stake deposit failed",
        description: error instanceof Error ? error.message : "Request failed."
      });
    }
  }

  async function handleWithdrawal(pool: CustomerStakingPoolSnapshot) {
    if (!isPositiveDecimalString(withdrawAmount)) {
      toast({
        variant: "destructive",
        title: "Invalid withdrawal amount",
        description: "Enter a positive ETH amount to withdraw."
      });
      return;
    }

    try {
      const result = await withdrawalMutation.mutateAsync({
        poolId: pool.id,
        amount: withdrawAmount
      });
      setWithdrawAmount("");
      toast({
        title: "Stake withdrawal submitted",
        description: `Transaction hash: ${result.transactionHash}`
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Stake withdrawal failed",
        description: error instanceof Error ? error.message : "Request failed."
      });
    }
  }

  async function handleClaimReward(pool: CustomerStakingPoolSnapshot) {
    try {
      const result = await claimRewardMutation.mutateAsync({
        poolId: pool.id
      });
      toast({
        title: "Reward claim submitted",
        description: `Transaction hash: ${result.transactionHash}`
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Reward claim failed",
        description: error instanceof Error ? error.message : "Request failed."
      });
    }
  }

  async function handleEmergencyWithdrawal(pool: CustomerStakingPoolSnapshot) {
    try {
      const result = await emergencyWithdrawalMutation.mutateAsync({
        poolId: pool.id
      });
      toast({
        title: "Emergency withdrawal submitted",
        description: `Transaction hash: ${result.transactionHash}`
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Emergency withdrawal failed",
        description: error instanceof Error ? error.message : "Request failed."
      });
    }
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold text-foreground">
            Ethereum Staking
          </h1>
          <Button asChild variant="outline">
            <Link to="/create-pool">Pool Governance</Link>
          </Button>
        </div>

        <Alert
          className={
            executionEnabled
              ? "border-mint-200 bg-mint-50"
              : "border-orange-200 bg-orange-50"
          }
        >
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>
            {executionEnabled
              ? "Customer staking execution is enabled"
              : "Customer staking execution remains policy-gated"}
          </AlertTitle>
          <AlertDescription>{executionMessage}</AlertDescription>
        </Alert>

        {stakingQuery.isError ? (
          <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {stakingQuery.error instanceof Error
              ? stakingQuery.error.message
              : "Failed to load staking snapshot."}
          </Card>
        ) : null}

        {snapshot && !snapshot.readModel.available ? (
          <Alert className="border-slate-200 bg-slate-50">
            <Database className="h-4 w-4" />
            <AlertTitle>Live position reads are limited</AlertTitle>
            <AlertDescription>{snapshot.readModel.message}</AlertDescription>
          </Alert>
        ) : null}

        <StakingStats pools={pools} />

        <Card className="glass-card p-6">
          <h2 className="mb-4 text-xl font-semibold">Available Validator Pools</h2>
          {stakingQuery.isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="rounded-lg border p-4">
                  <div className="h-5 w-40 animate-pulse rounded bg-muted" />
                  <div className="mt-3 h-4 w-56 animate-pulse rounded bg-muted" />
                  <div className="mt-2 h-4 w-44 animate-pulse rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : pools.length > 0 ? (
            <div className="space-y-4">
              {pools.map((pool) => (
                <PoolCard
                  key={pool.id}
                  pool={pool}
                  onSelect={(nextPool) => setSelectedPoolId(nextPool.id)}
                  isSelected={selectedPool?.id === pool.id}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              No staking pools are currently listed for customer review.
            </div>
          )}
        </Card>

        {selectedPool ? (
          <Card className="glass-card p-6 animate-in">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">
                  Pool #{selectedPool.id} Overview
                </h2>
                <p className="text-sm text-muted-foreground">
                  Live product registry detail for the selected pool.
                </p>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                {selectedPool.poolStatus}
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Reward Rate</p>
                <p className="mt-2 text-2xl font-semibold">
                  {selectedPool.rewardRate}%
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Total Staked</p>
                <p className="mt-2 text-2xl font-semibold">
                  {formatTokenAmount(selectedPool.totalStakedAmount, 4)} ETH
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Rewards Paid</p>
                <p className="mt-2 text-2xl font-semibold">
                  {formatTokenAmount(selectedPool.totalRewardsPaid, 4)} ETH
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Blockchain Pool</p>
                <p className="mt-2 text-2xl font-semibold">
                  {selectedPool.blockchainPoolId ?? "Pending"}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Database className="h-4 w-4 text-mint-700" />
                  Registry Timeline
                </div>
                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <p>Created {formatDateLabel(selectedPool.createdAt)}</p>
                  <p>Updated {formatDateLabel(selectedPool.updatedAt)}</p>
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Clock3 className="h-4 w-4 text-mint-700" />
                  Managed Customer Context
                </div>
                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <p>Managed wallet: {formatShortAddress(snapshot?.walletAddress ?? user?.ethereumAddress)}</p>
                  <p>
                    Account status: {snapshot?.accountStatus ?? "unknown"}.
                  </p>
                  <p>Wallet custody: {snapshot?.walletCustodyType ?? "unknown"}.</p>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Wallet className="h-4 w-4 text-mint-700" />
                  Customer Position
                </div>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Staked Balance</p>
                    <p className="mt-1 text-2xl font-semibold">
                      {formatTokenAmount(selectedPool.position.stakedBalance, 4)} ETH
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Pending Reward</p>
                    <p className="mt-1 text-2xl font-semibold">
                      {formatTokenAmount(selectedPool.position.pendingReward, 4)} ETH
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <ShieldAlert className="h-4 w-4 text-mint-700" />
                  Execution Controls
                </div>
                <div className="mt-3 space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="stake-deposit-amount">
                      Deposit Amount (ETH)
                    </label>
                    <Input
                      id="stake-deposit-amount"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={depositAmount}
                      onChange={(event) => setDepositAmount(event.target.value)}
                      disabled={!executionEnabled || executionPending}
                    />
                    <Button
                      className="w-full"
                      disabled={!executionEnabled || executionPending}
                      onClick={() => void handleDeposit(selectedPool)}
                    >
                      Stake ETH
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="stake-withdraw-amount">
                      Withdrawal Amount (ETH)
                    </label>
                    <Input
                      id="stake-withdraw-amount"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={withdrawAmount}
                      onChange={(event) => setWithdrawAmount(event.target.value)}
                      disabled={!executionEnabled || executionPending}
                    />
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={!executionEnabled || executionPending}
                      onClick={() => void handleWithdrawal(selectedPool)}
                    >
                      Withdraw Stake
                    </Button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Button
                      variant="outline"
                      disabled={
                        !executionEnabled ||
                        executionPending ||
                        Number(selectedPool.position.pendingReward) <= 0
                      }
                      onClick={() => void handleClaimReward(selectedPool)}
                    >
                      Claim Rewards
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={
                        !executionEnabled ||
                        executionPending ||
                        Number(selectedPool.position.stakedBalance) <= 0
                      }
                      onClick={() => void handleEmergencyWithdrawal(selectedPool)}
                    >
                      Emergency Exit
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {!executionEnabled ? (
              <div className="mt-6 rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
                Execution is currently disabled by the backend for this managed
                customer wallet. The UI is wired to the real API and will only
                enable staking actions when the backend explicitly marks the
                execution path safe.
              </div>
            ) : null}
          </Card>
        ) : pools.length > 0 ? (
          <Card className="glass-card p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-mint-700" />
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Select a pool to inspect live details
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  The pool list and customer position data are live. Select a
                  pool to review execution availability and customer position
                  details.
                </p>
              </div>
            </div>
          </Card>
        ) : null}
      </div>
    </Layout>
  );
};

export default Staking;
