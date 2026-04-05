import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { useMyBalances } from "@/hooks/balances/useMyBalances";
import { useSupportedAssets } from "@/hooks/assets/useSupportedAssets";
import DepositCard from "./wallet/DepositCard";
import WithdrawCard from "./wallet/WithdrawCard";
import { useUserStore } from "@/stores/userStore";

const Wallet = () => {
  const user = useUserStore((state) => state.user);
  const supportedAssetsQuery = useSupportedAssets();
  const balancesQuery = useMyBalances();

  return (
    <Layout>
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">
            Managed Wallet Operations
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Create truthful deposit and withdrawal requests against the live
            managed wallet and supported asset registry. Every request lands in
            the customer transaction workflow and appears in{" "}
            <Link className="font-medium text-foreground underline" to="/transactions">
              transaction history
            </Link>
            .
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <DepositCard
            walletAddress={user?.ethereumAddress ?? null}
            assets={supportedAssetsQuery.data?.assets ?? []}
            isAssetsLoading={supportedAssetsQuery.isLoading}
            assetsErrorMessage={
              supportedAssetsQuery.isError
                ? supportedAssetsQuery.error instanceof Error
                  ? supportedAssetsQuery.error.message
                  : "Failed to load supported assets."
                : null
            }
          />
          <WithdrawCard
            walletAddress={user?.ethereumAddress ?? null}
            assets={supportedAssetsQuery.data?.assets ?? []}
            balances={balancesQuery.data?.balances ?? []}
            isAssetsLoading={supportedAssetsQuery.isLoading}
            isBalancesLoading={balancesQuery.isLoading}
            assetsErrorMessage={
              supportedAssetsQuery.isError
                ? supportedAssetsQuery.error instanceof Error
                  ? supportedAssetsQuery.error.message
                  : "Failed to load supported assets."
                : null
            }
            balancesErrorMessage={
              balancesQuery.isError
                ? balancesQuery.error instanceof Error
                  ? balancesQuery.error.message
                  : "Failed to load customer balances."
                : null
            }
          />
        </div>

        <Card className="glass-card p-6">
          <h2 className="text-xl font-semibold text-foreground">
            Operational Notes
          </h2>
          <div className="mt-4 space-y-3 text-sm text-muted-foreground">
            <p>
              Deposit requests record an expected inbound transfer and bind it to
              your managed wallet address. They do not broadcast a chain
              transaction from this browser.
            </p>
            <p>
              Withdrawal requests reserve balance immediately by moving the
              requested amount from available into pending while review and
              custody execution proceed.
            </p>
            <p>
              Use the transaction history page to confirm each request entered
              the workflow and to track later approval, queueing, broadcast,
              confirmation, and settlement states.
            </p>
          </div>
        </Card>
      </div>
    </Layout>
  );
};

export default Wallet;
