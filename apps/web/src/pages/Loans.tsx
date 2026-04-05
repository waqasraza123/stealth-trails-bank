import { Layout } from "@/components/Layout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMyBalances } from "@/hooks/balances/useMyBalances";
import { useMyTransactionHistory } from "@/hooks/transactions/useMyTransactionHistory";
import { useGetUser } from "@/hooks/user/useGetUser";
import {
  formatAccountStatusLabel,
  getAccountStatusBadgeTone,
  getAccountStatusSummary
} from "@/lib/customer-account";
import {
  formatDateLabel,
  formatIntentAmount,
  formatTokenAmount,
  isPositiveDecimalString,
  normalizeIntentTypeLabel
} from "@/lib/customer-finance";
import { useUserStore } from "@/stores/userStore";
import {
  ArrowRight,
  Landmark,
  PiggyBank,
  ShieldAlert,
  Wallet
} from "lucide-react";
import { Link } from "react-router-dom";

const Loans = () => {
  const user = useUserStore((state) => state.user);
  const profileQuery = useGetUser(user?.supabaseUserId);
  const balancesQuery = useMyBalances();
  const historyQuery = useMyTransactionHistory(10);

  const profile = profileQuery.data;
  const balances = balancesQuery.data?.balances ?? [];
  const fundedBalances = balances.filter(
    (balance) =>
      isPositiveDecimalString(balance.availableBalance) ||
      isPositiveDecimalString(balance.pendingBalance)
  );
  const latestIntent = historyQuery.data?.intents[0] ?? null;

  return (
    <Layout>
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">
            Loans & Savings
          </h1>
          <p className="text-sm text-muted-foreground">
            Truthful availability surface for capital products in the managed
            customer portal.
          </p>
        </div>

        <Alert className="border-orange-200 bg-orange-50">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Customer self-service lending is not enabled</AlertTitle>
          <AlertDescription>
            The current customer API exposes balances, account lifecycle, wallet
            linkage, and ledger history. It does not expose loan origination,
            repayment schedules, savings products, APYs, or customer application
            workflows, so the old mocked forms were removed.
          </AlertDescription>
        </Alert>

        <div className="grid gap-6 xl:grid-cols-3">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Landmark className="h-5 w-5 text-mint-600" />
                Account Readiness
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge
                  variant="outline"
                  className={getAccountStatusBadgeTone(profile?.accountStatus)}
                >
                  {formatAccountStatusLabel(profile?.accountStatus)}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {profileQuery.isError
                  ? profileQuery.error instanceof Error
                    ? profileQuery.error.message
                    : "Failed to load customer account status."
                  : getAccountStatusSummary(profile?.accountStatus)}
              </p>
              <div className="rounded-xl border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Customer account reference
                </p>
                <p className="mt-2 font-medium text-foreground">
                  {profile?.customerId ?? "Not exposed"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PiggyBank className="h-5 w-5 text-mint-600" />
                Managed Asset Coverage
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {balancesQuery.isError ? (
                <p className="text-sm text-red-700">
                  {balancesQuery.error instanceof Error
                    ? balancesQuery.error.message
                    : "Failed to load managed balances."}
                </p>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Assets tracked
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-foreground">
                        {balancesQuery.isLoading ? "..." : balances.length}
                      </p>
                    </div>
                    <div className="rounded-xl border p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Funded assets
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-foreground">
                        {balancesQuery.isLoading ? "..." : fundedBalances.length}
                      </p>
                    </div>
                  </div>
                  {fundedBalances.length > 0 ? (
                    <div className="space-y-3">
                      {fundedBalances.slice(0, 3).map((balance) => (
                        <div
                          key={balance.asset.id}
                          className="rounded-xl border border-border/70 bg-white/70 p-4"
                        >
                          <p className="text-sm font-medium text-foreground">
                            {balance.asset.displayName}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {formatTokenAmount(balance.availableBalance)} {balance.asset.symbol} available
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No funded customer balances are currently available to
                      support a capital-products view.
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-mint-600" />
                Recent Ledger Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {historyQuery.isError ? (
                <p className="text-sm text-red-700">
                  {historyQuery.error instanceof Error
                    ? historyQuery.error.message
                    : "Failed to load customer ledger activity."}
                </p>
              ) : latestIntent ? (
                <>
                  <div className="rounded-xl border p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Latest recorded activity
                    </p>
                    <p className="mt-2 text-lg font-semibold text-foreground">
                      {normalizeIntentTypeLabel(latestIntent.intentType)}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatIntentAmount(
                        latestIntent.settledAmount ?? latestIntent.requestedAmount,
                        latestIntent.asset.symbol,
                        latestIntent.intentType
                      )}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {latestIntent.status} on {formatDateLabel(latestIntent.createdAt)}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {historyQuery.data?.intents.length ?? 0} recent ledger
                    events are available for the customer portal.
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No customer ledger activity has been recorded yet.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Why the old product forms were removed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border p-4">
                <p className="text-sm font-medium text-foreground">
                  No lending origination API
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  The backend does not currently expose customer loan
                  applications, underwriting decisions, or repayment schedules.
                </p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-sm font-medium text-foreground">
                  No savings product ledger
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Savings balances, APYs, term products, and maturity logic are
                  not available from the customer API today.
                </p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-sm font-medium text-foreground">
                  No customer-safe approvals flow
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Exposing fake application buttons would imply operational
                  controls that do not yet exist in production.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild className="bg-apple-blue hover:bg-apple-blue/90">
                <Link to="/wallet">
                  Review Wallet Activity
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/transactions">Inspect Ledger History</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/profile">Review Account Status</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Loans;
