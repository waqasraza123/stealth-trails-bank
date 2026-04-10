import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { useT } from "@/i18n/use-t";
import { useLocale } from "@/i18n/use-locale";
import { useMyBalances } from "@/hooks/balances/useMyBalances";
import { useSupportedAssets } from "@/hooks/assets/useSupportedAssets";
import DepositCard from "./wallet/DepositCard";
import WithdrawCard from "./wallet/WithdrawCard";
import { useUserStore } from "@/stores/userStore";
import { formatDateLabel, formatTokenAmount } from "@/lib/customer-finance";
import { formatRelativeTimeLabel, isTimestampOlderThan } from "@stealth-trails-bank/ui-foundation";

const Wallet = () => {
  const t = useT();
  const { locale } = useLocale();
  const user = useUserStore((state) => state.user);
  const supportedAssetsQuery = useSupportedAssets();
  const balancesQuery = useMyBalances();
  const balances = balancesQuery.data?.balances ?? [];
  const latestBalanceUpdate = balances
    .map((balance) => balance.updatedAt)
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0];
  const staleBalanceData = isTimestampOlderThan(latestBalanceUpdate, 24);

  return (
    <Layout>
      <div className="space-y-6">
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="stb-surface rounded-[2rem] border-0 p-6">
            <div className="space-y-4">
              <div>
                <p className="stb-section-kicker">
                  {locale === "ar" ? "المحفظة" : "Wallet"}
                </p>
                <h1 className="stb-page-title mt-2 text-3xl font-semibold text-slate-950">
                  {t("wallet.title")}
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                  {t("wallet.description")}{" "}
                  <Link className="font-semibold text-slate-950 underline" to="/transactions">
                    {t("wallet.historyLink")}
                  </Link>
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-[1.4rem] bg-white/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {locale === "ar" ? "الأصول المدعومة" : "Supported assets"}
                  </p>
                  <p className="mt-3 text-3xl font-semibold text-slate-950">
                    {supportedAssetsQuery.isLoading
                      ? "..."
                      : supportedAssetsQuery.data?.assets.length ?? 0}
                  </p>
                </div>
                <div className="rounded-[1.4rem] bg-white/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {locale === "ar" ? "أصول ممولة" : "Funded assets"}
                  </p>
                  <p className="mt-3 text-3xl font-semibold text-slate-950">
                    {balances.filter((balance) => Number(balance.availableBalance) > 0).length}
                  </p>
                </div>
                <div className="rounded-[1.4rem] bg-slate-950 p-4 text-white">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">
                    {locale === "ar" ? "مرجع المحفظة" : "Wallet reference"}
                  </p>
                  <p className="stb-ref mt-3 text-sm font-medium text-white">
                    <bdi>{user?.ethereumAddress ?? t("layout.noWallet")}</bdi>
                  </p>
                </div>
              </div>

              {latestBalanceUpdate ? (
                <div
                  className={`rounded-[1.4rem] border p-4 text-sm ${
                    staleBalanceData
                      ? "border-amber-200 bg-amber-50 text-amber-900"
                      : "border-slate-200 bg-white/80 text-slate-700"
                  }`}
                  role="status"
                >
                  {staleBalanceData
                    ? locale === "ar"
                      ? `تأخر آخر تحديث للأرصدة. آخر مزامنة كانت ${formatDateLabel(
                          latestBalanceUpdate,
                          locale
                        )} (${formatRelativeTimeLabel(latestBalanceUpdate, locale)}).`
                      : `Balance data is older than expected. Last synced ${formatDateLabel(
                          latestBalanceUpdate,
                          locale
                        )} (${formatRelativeTimeLabel(latestBalanceUpdate, locale)}).`
                    : locale === "ar"
                      ? `آخر مزامنة للأرصدة ${formatDateLabel(
                          latestBalanceUpdate,
                          locale
                        )} (${formatRelativeTimeLabel(latestBalanceUpdate, locale)}).`
                      : `Balances last synced ${formatDateLabel(
                          latestBalanceUpdate,
                          locale
                        )} (${formatRelativeTimeLabel(latestBalanceUpdate, locale)}).`}
                </div>
              ) : null}

              {balancesQuery.isError ? (
                <div
                  className="rounded-[1.4rem] border border-red-200 bg-red-50 p-4 text-sm text-red-700"
                  role="alert"
                >
                  {balancesQuery.error instanceof Error
                    ? balancesQuery.error.message
                    : t("wallet.balancesError")}
                </div>
              ) : balances.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {balances.map((balance) => (
                    <div
                      key={balance.asset.id}
                      className="rounded-[1.4rem] border border-slate-200 bg-white/80 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-950">
                          {balance.asset.displayName}
                        </p>
                        <span className="text-xs uppercase tracking-[0.12em] text-slate-500">
                          {balance.asset.symbol}
                        </span>
                      </div>
                      <div className="mt-4 grid gap-2 text-sm text-slate-600">
                        <div className="flex justify-between gap-3">
                          <span>{locale === "ar" ? "متاح" : "Available"}</span>
                          <span className="font-semibold text-slate-950">
                            {formatTokenAmount(balance.availableBalance, locale)} {balance.asset.symbol}
                          </span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span>{locale === "ar" ? "معلّق" : "Pending"}</span>
                          <span className="font-semibold text-slate-950">
                            {formatTokenAmount(balance.pendingBalance, locale)} {balance.asset.symbol}
                          </span>
                        </div>
                      </div>
                      <p className="mt-3 text-xs uppercase tracking-[0.12em] text-slate-500">
                        {formatDateLabel(balance.updatedAt, locale)} ·{" "}
                        {formatRelativeTimeLabel(balance.updatedAt, locale)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </Card>

          <Card className="stb-surface rounded-[2rem] border-0 p-6">
            <h2 className="text-xl font-semibold text-slate-950">
              {locale === "ar" ? "ما الذي سيحدث بعد ذلك" : "What happens next"}
            </h2>
            <div className="mt-5 space-y-4 text-sm leading-7 text-slate-600">
              <p>{t("wallet.noteOne")}</p>
              <p>{t("wallet.noteTwo")}</p>
              <p>{t("wallet.noteThree")}</p>
            </div>
          </Card>
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          <DepositCard
            walletAddress={user?.ethereumAddress ?? null}
            assets={supportedAssetsQuery.data?.assets ?? []}
            isAssetsLoading={supportedAssetsQuery.isLoading}
            assetsErrorMessage={
              supportedAssetsQuery.isError
                ? supportedAssetsQuery.error instanceof Error
                  ? supportedAssetsQuery.error.message
                  : t("wallet.supportedAssetsError")
                : null
            }
          />
          <WithdrawCard
            walletAddress={user?.ethereumAddress ?? null}
            assets={supportedAssetsQuery.data?.assets ?? []}
            balances={balances}
            isAssetsLoading={supportedAssetsQuery.isLoading}
            isBalancesLoading={balancesQuery.isLoading}
            assetsErrorMessage={
              supportedAssetsQuery.isError
                ? supportedAssetsQuery.error instanceof Error
                  ? supportedAssetsQuery.error.message
                  : t("wallet.supportedAssetsError")
                : null
            }
            balancesErrorMessage={
              balancesQuery.isError
                ? balancesQuery.error instanceof Error
                  ? balancesQuery.error.message
                  : t("wallet.balancesError")
                : null
            }
          />
        </div>
      </div>
    </Layout>
  );
};

export default Wallet;
