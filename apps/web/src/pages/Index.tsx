import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  Clock3,
  Landmark,
  Wallet
} from "lucide-react";
import { BalanceCard } from "@/components/dashboard/BalanceCard";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { useMyBalances } from "@/hooks/balances/useMyBalances";
import {
  useMyTransactionHistory,
  type TransactionHistoryIntent
} from "@/hooks/transactions/useMyTransactionHistory";
import {
  formatDateLabel,
  formatIntentAmount,
  formatShortAddress,
  formatTokenAmount,
  normalizeIntentTypeLabel,
  resolveIntentAddress
} from "@/lib/customer-finance";
import { useUserStore } from "@/stores/userStore";

function hasPendingBalance(value: string): boolean {
  return Number(value) > 0;
}

function mapRecentTransactions(intents: TransactionHistoryIntent[] | undefined) {
  if (!intents) {
    return [];
  }

  return intents.slice(0, 5).map((intent) => ({
    id: intent.id,
    type: normalizeIntentTypeLabel(intent.intentType),
    amount: formatIntentAmount(
      intent.settledAmount ?? intent.requestedAmount,
      intent.asset.symbol,
      intent.intentType
    ),
    date: formatDateLabel(intent.createdAt),
    status: intent.status,
    address: formatShortAddress(resolveIntentAddress(intent))
  }));
}

const Index = () => {
  const user = useUserStore((state) => state.user);
  const balancesQuery = useMyBalances();
  const historyQuery = useMyTransactionHistory(5);

  const balances = balancesQuery.data?.balances ?? [];
  const pendingAssetCount = balances.filter((balance) =>
    hasPendingBalance(balance.pendingBalance)
  ).length;
  const recentTransactions = mapRecentTransactions(historyQuery.data?.intents);

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              {user?.firstName
                ? `Managed account overview for ${user.firstName}.`
                : "Managed account overview."}
            </p>
          </div>
          <Button asChild className="bg-apple-blue hover:bg-apple-blue/90">
            <Link to="/transactions">
              <Activity className="mr-2 h-4 w-4" />
              View History
            </Link>
          </Button>
        </div>

        <Card className="glass-card overflow-hidden">
          <div className="grid gap-6 p-6 lg:grid-cols-[1.3fr_0.7fr]">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Wallet className="h-4 w-4 text-mint-700" />
                Managed Wallet
              </div>
              <div className="rounded-2xl border border-border/70 bg-white/60 p-4">
                <p className="font-mono text-sm text-foreground break-all">
                  {user?.ethereumAddress ?? "No managed wallet assigned yet."}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  This address is the current managed product-chain wallet linked to your customer profile.
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-2xl border border-border/70 bg-white/60 p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Landmark className="h-4 w-4" />
                  Assets Tracked
                </div>
                <p className="mt-3 text-2xl font-semibold text-foreground">
                  {balancesQuery.isLoading ? "..." : balances.length}
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-white/60 p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock3 className="h-4 w-4" />
                  Pending Assets
                </div>
                <p className="mt-3 text-2xl font-semibold text-foreground">
                  {balancesQuery.isLoading ? "..." : pendingAssetCount}
                </p>
              </div>
              <Button asChild variant="outline" className="h-auto justify-between rounded-2xl px-4 py-4">
                <Link to="/wallet">
                  Open Wallet Actions
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </Card>

        {balancesQuery.isError ? (
          <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {balancesQuery.error instanceof Error
              ? balancesQuery.error.message
              : "Failed to load customer balances."}
          </Card>
        ) : balancesQuery.isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Card key={index} className="glass-card p-6">
                <div className="space-y-4">
                  <div className="h-4 w-28 animate-pulse rounded bg-muted" />
                  <div className="h-8 w-40 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                </div>
              </Card>
            ))}
          </div>
        ) : balances.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {balances.map((balance) => (
              <BalanceCard
                key={balance.asset.id}
                title={balance.asset.displayName}
                amount={`${formatTokenAmount(balance.availableBalance)} ${balance.asset.symbol}`}
                subAmount={
                  hasPendingBalance(balance.pendingBalance)
                    ? `${formatTokenAmount(balance.pendingBalance)} ${balance.asset.symbol} pending`
                    : "No pending balance"
                }
                icon={hasPendingBalance(balance.pendingBalance) ? Clock3 : Landmark}
                tone={hasPendingBalance(balance.pendingBalance) ? "warning" : "positive"}
                footer={`Updated ${formatDateLabel(balance.updatedAt)}`}
              />
            ))}
          </div>
        ) : (
          <Card className="glass-card p-6">
            <h2 className="text-lg font-semibold text-foreground">No balances yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Once deposit and settlement activity starts, tracked asset balances will appear here.
            </p>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <RecentTransactions
            transactions={recentTransactions}
            isLoading={historyQuery.isLoading}
            errorMessage={
              historyQuery.isError
                ? historyQuery.error instanceof Error
                  ? historyQuery.error.message
                  : "Failed to load transaction history."
                : null
            }
            emptyMessage="No transaction history has been recorded for this account yet."
          />
        </div>
      </div>
    </Layout>
  );
};

export default Index;
