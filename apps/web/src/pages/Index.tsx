import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  Clock3,
  Landmark,
  ShieldCheck,
  Sparkles,
  Wallet
} from "lucide-react";
import { Layout } from "@/components/Layout";
import { StatusBadge } from "@/components/customer/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLocale } from "@/i18n/use-locale";
import { useT } from "@/i18n/use-t";
import { useMyBalances } from "@/hooks/balances/useMyBalances";
import { useMyTransactionHistory } from "@/hooks/transactions/useMyTransactionHistory";
import {
  formatRelativeTimeLabel,
  getTransactionConfidenceTone,
  isTimestampOlderThan
} from "@stealth-trails-bank/ui-foundation";
import {
  formatDateLabel,
  formatIntentAmount,
  formatIntentStatusLabel,
  formatShortAddress,
  formatTokenAmount,
  getIntentConfidenceStatus,
  normalizeIntentTypeLabel,
  resolveIntentAddress
} from "@/lib/customer-finance";
import { useUserStore } from "@/stores/userStore";

function hasPendingBalance(value: string): boolean {
  return Number(value) > 0;
}

const Index = () => {
  const t = useT();
  const { locale } = useLocale();
  const user = useUserStore((state) => state.user);
  const balancesQuery = useMyBalances();
  const historyQuery = useMyTransactionHistory(5);

  const balances = balancesQuery.data?.balances ?? [];
  const intents = historyQuery.data?.intents ?? [];
  const pendingAssetCount = balances.filter((balance) =>
    hasPendingBalance(balance.pendingBalance)
  ).length;
  const latestBalanceUpdate = balances
    .map((balance) => balance.updatedAt)
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0];
  const latestIntentUpdate = intents
    .map((intent) => intent.updatedAt)
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0];
  const staleOperationalData =
    isTimestampOlderThan(latestBalanceUpdate, 24) ||
    isTimestampOlderThan(latestIntentUpdate, 24);

  return (
    <Layout>
      <div className="space-y-6">
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
          <Card className="stb-surface overflow-hidden rounded-[2rem] border-0">
            <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-5">
                <div className="space-y-3">
                  <p className="stb-section-kicker">
                    {locale === "ar" ? "نظرة عامة" : "Overview"}
                  </p>
                  <h2 className="stb-page-title text-3xl font-semibold text-slate-950">
                    {t("dashboard.title")}
                  </h2>
                  <p className="max-w-2xl text-sm leading-7 text-slate-600">
                    {user?.firstName
                      ? t("dashboard.descriptionWithName", { name: user.firstName })
                      : t("dashboard.description")}
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-[1.4rem] bg-white/75 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {locale === "ar" ? "الأصول المتاحة" : "Available assets"}
                    </p>
                    <p className="mt-3 text-3xl font-semibold text-slate-950">
                      {balancesQuery.isLoading ? "..." : balances.length}
                    </p>
                  </div>
                  <div className="rounded-[1.4rem] bg-white/75 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {locale === "ar" ? "الحالات المعلقة" : "Pending states"}
                    </p>
                    <p className="mt-3 text-3xl font-semibold text-slate-950">
                      {balancesQuery.isLoading ? "..." : pendingAssetCount}
                    </p>
                  </div>
                  <div className="rounded-[1.4rem] bg-slate-950 p-4 text-white">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">
                      {locale === "ar" ? "سجل الأموال" : "Money movement"}
                    </p>
                    <p className="mt-3 text-3xl font-semibold">
                      {historyQuery.isLoading ? "..." : intents.length}
                    </p>
                  </div>
                </div>

                {(latestBalanceUpdate || latestIntentUpdate) ? (
                  <div
                    className={`rounded-[1.4rem] border p-4 text-sm ${
                      staleOperationalData
                        ? "border-amber-200 bg-amber-50 text-amber-900"
                        : "border-slate-200 bg-white/80 text-slate-700"
                    }`}
                    role="status"
                  >
                    {staleOperationalData
                      ? locale === "ar"
                        ? "تظهر آخر لقطة تشغيلية أقدم من المتوقع. راجع الإيداعات المعلقة أو أعد التحميل إذا استمر التأخير."
                        : "The latest operational snapshot is older than expected. Review pending money movement or refresh if the delay continues."
                      : locale === "ar"
                        ? `آخر تحديث للأرصدة ${latestBalanceUpdate ? formatRelativeTimeLabel(latestBalanceUpdate, locale) : "غير متاح"} وآخر تحديث للمعاملات ${latestIntentUpdate ? formatRelativeTimeLabel(latestIntentUpdate, locale) : "غير متاح"}.`
                        : `Balances refreshed ${latestBalanceUpdate ? formatRelativeTimeLabel(latestBalanceUpdate, locale) : "not available"} and transaction state refreshed ${latestIntentUpdate ? formatRelativeTimeLabel(latestIntentUpdate, locale) : "not available"}.`}
                  </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1.4rem] border border-slate-200 bg-white/80 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <Wallet className="h-4 w-4 text-emerald-700" />
                      {locale === "ar" ? "عنوان المحفظة المُدار" : "Managed wallet address"}
                    </div>
                    <p className="stb-ref mt-3 break-all text-sm font-semibold text-slate-950">
                      <bdi>{user?.ethereumAddress ?? t("layout.noWallet")}</bdi>
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      {locale === "ar"
                        ? "يبقى هذا المرجع قابلاً للتتبع خلال الإيداع والسحب والمراجعة."
                        : "This reference stays traceable across deposit, withdrawal, and review."}
                    </p>
                  </div>
                  <div className="rounded-[1.4rem] border border-slate-200 bg-white/80 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <ShieldCheck className="h-4 w-4 text-emerald-700" />
                      {locale === "ar" ? "طبقة الثقة" : "Trust layer"}
                    </div>
                    <div className="mt-3 space-y-2 text-sm text-slate-600">
                      <p>
                        {locale === "ar"
                          ? "يتم تتبع الطلبات برقم مرجعي واضح."
                          : "Requests remain traceable by clear reference IDs."}
                      </p>
                      <p>
                        {locale === "ar"
                          ? "تظهر الحالات كخطوات واضحة بدلاً من انتظار غامض."
                          : "Statuses appear as clear steps instead of ambiguous waiting."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 rounded-[1.6rem] bg-slate-950 p-5 text-white">
                <div className="flex items-center gap-2 text-sm font-medium text-white/84">
                  <Clock3 className="h-4 w-4 text-amber-300" />
                  {locale === "ar" ? "نشاط يحتاج متابعة" : "Activity that needs watching"}
                </div>
                {intents.length > 0 ? (
                  intents.slice(0, 3).map((intent) => {
                    const confidence = getIntentConfidenceStatus(intent.status);

                    return (
                      <div
                        key={intent.id}
                        className="rounded-[1.25rem] border border-white/10 bg-white/6 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">
                              {normalizeIntentTypeLabel(intent.intentType, locale)}
                            </p>
                            <p className="mt-1 text-sm text-white/68">
                              {formatIntentAmount(
                                intent.settledAmount ?? intent.requestedAmount,
                                intent.asset.symbol,
                                intent.intentType,
                                locale
                              )}
                            </p>
                          </div>
                          <StatusBadge
                            label={formatIntentStatusLabel(intent.status, locale)}
                            tone={getTransactionConfidenceTone(confidence)}
                            className="!bg-white/10 !text-white before:!bg-white/80"
                          />
                        </div>
                        <p className="mt-3 text-xs uppercase tracking-[0.12em] text-white/45">
                          {formatDateLabel(intent.createdAt, locale)}
                        </p>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-[1.25rem] border border-dashed border-white/18 p-4 text-sm text-white/68">
                    {t("dashboard.emptyHistory")}
                  </div>
                )}
                <Button
                  asChild
                  className="w-full rounded-[1rem] bg-white text-slate-950 hover:bg-white/90"
                >
                  <Link to="/transactions">
                    <Activity className="h-4 w-4" />
                    <span>{t("dashboard.viewHistory")}</span>
                  </Link>
                </Button>
              </div>
            </div>
          </Card>

          <Card className="stb-surface rounded-[2rem] border-0 p-6">
            <div className="space-y-5">
              <div>
                <p className="stb-section-kicker">
                  {locale === "ar" ? "العائد" : "Yield"}
                </p>
                <h3 className="stb-page-title mt-2 text-2xl font-semibold text-slate-950">
                  {locale === "ar" ? "وضع المنتج" : "Product posture"}
                </h3>
              </div>
              <div className="rounded-[1.5rem] bg-white/85 p-5">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-indigo-700" />
                  <p className="text-sm font-semibold text-slate-900">
                    {locale === "ar" ? "البنية التحتية أولاً" : "Infrastructure-first yield"}
                  </p>
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {locale === "ar"
                    ? "يتم عرض العائد كمنتج خاضع للسيطرة والحالة، وليس كدعوة مضاربية."
                    : "Yield is presented as a controlled product with visible state, not speculative urgency."}
                </p>
              </div>
              <div className="rounded-[1.5rem] bg-slate-950 p-5 text-white">
                <p className="text-sm font-semibold text-white">
                  {locale === "ar" ? "المتابعة التالية" : "Next review"}
                </p>
                <p className="mt-3 text-sm leading-7 text-white/70">
                  {locale === "ar"
                    ? "راجع الأهلية والحالة والمكافآت المتراكمة قبل بدء أي حركة."
                    : "Review eligibility, pool state, and accrued rewards before starting any action."}
                </p>
                <Button
                  asChild
                  variant="outline"
                  className="mt-5 rounded-full border-white/20 bg-white/8 text-white hover:bg-white/12"
                >
                  <Link to="/yield">
                    {locale === "ar" ? "فتح العائد" : "Open yield"}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </Card>
        </section>

        {balancesQuery.isError ? (
          <Card className="rounded-[1.6rem] border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {balancesQuery.error instanceof Error
              ? balancesQuery.error.message
              : t("dashboard.loadBalancesError")}
          </Card>
        ) : balances.length > 0 ? (
          <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {balances.map((balance) => (
              <Card key={balance.asset.id} className="stb-surface rounded-[1.7rem] border-0 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {balance.asset.displayName}
                    </p>
                    <p className="mt-2 text-3xl font-semibold text-slate-950">
                      {formatTokenAmount(balance.availableBalance, locale)}{" "}
                      <span className="text-base text-slate-500">{balance.asset.symbol}</span>
                    </p>
                  </div>
                  <StatusBadge
                    label={
                      hasPendingBalance(balance.pendingBalance)
                        ? locale === "ar"
                          ? "معلّق"
                          : "Pending"
                        : locale === "ar"
                          ? "متاح"
                          : "Available"
                    }
                    tone={hasPendingBalance(balance.pendingBalance) ? "warning" : "positive"}
                  />
                </div>
                <div className="mt-5 grid gap-3 rounded-[1.25rem] bg-white/75 p-4 text-sm text-slate-600">
                  <div className="flex items-center justify-between gap-3">
                    <span>{locale === "ar" ? "متاح" : "Available"}</span>
                    <span className="font-semibold text-slate-950">
                      {formatTokenAmount(balance.availableBalance, locale)} {balance.asset.symbol}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>{locale === "ar" ? "معلّق" : "Pending"}</span>
                    <span className="font-semibold text-slate-950">
                      {formatTokenAmount(balance.pendingBalance, locale)} {balance.asset.symbol}
                    </span>
                  </div>
                </div>
                <p className="mt-4 text-xs uppercase tracking-[0.12em] text-slate-500">
                  {t("dashboard.updatedPrefix", {
                    date: formatDateLabel(balance.updatedAt, locale)
                  })}
                </p>
              </Card>
            ))}
          </section>
        ) : (
          <Card className="stb-surface rounded-[1.7rem] border-0 p-6">
            <h2 className="text-lg font-semibold text-slate-950">
              {t("dashboard.noBalancesTitle")}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {t("dashboard.noBalancesDescription")}
            </p>
          </Card>
        )}

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Card className="stb-surface rounded-[1.8rem] border-0 p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="stb-section-kicker">{t("dashboard.recentTransactions")}</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                  {locale === "ar" ? "النشاط الحديث" : "Recent activity"}
                </h2>
              </div>
              <Button asChild variant="outline" className="rounded-full">
                <Link to="/transactions">{t("dashboard.viewAll")}</Link>
              </Button>
            </div>

            <div className="mt-5 space-y-3">
              {historyQuery.isError ? (
                <div className="rounded-[1.3rem] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {historyQuery.error instanceof Error
                    ? historyQuery.error.message
                    : t("dashboard.historyError")}
                </div>
              ) : intents.length > 0 ? (
                intents.map((intent) => {
                  const confidence = getIntentConfidenceStatus(intent.status);

                  return (
                    <div
                      key={intent.id}
                      className="rounded-[1.4rem] border border-slate-200 bg-white/80 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-950">
                            {normalizeIntentTypeLabel(intent.intentType, locale)}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            {formatIntentAmount(
                              intent.settledAmount ?? intent.requestedAmount,
                              intent.asset.symbol,
                              intent.intentType,
                              locale
                            )}
                          </p>
                        </div>
                        <StatusBadge
                          label={formatIntentStatusLabel(intent.status, locale)}
                          tone={getTransactionConfidenceTone(confidence)}
                        />
                      </div>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
                        <span>{formatDateLabel(intent.createdAt, locale)}</span>
                        <span className="stb-ref">
                          <bdi>
                            {formatShortAddress(
                              resolveIntentAddress(intent),
                              t("shared.notAvailable")
                            )}
                          </bdi>
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="rounded-[1.3rem] border border-dashed border-slate-300 p-4 text-sm text-slate-600">
                  {t("dashboard.emptyHistory")}
                </p>
              )}
            </div>
          </Card>

          <Card className="stb-surface rounded-[1.8rem] border-0 p-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Landmark className="h-4 w-4 text-emerald-700" />
              {locale === "ar" ? "الثقة والسلامة" : "Trust & safety"}
            </div>
            <div className="mt-5 space-y-4 text-sm leading-7 text-slate-600">
              <p>
                {locale === "ar"
                  ? "تعرض عمليات الإيداع والسحب الحالة الحالية والخطوة التالية والتأخير المتوقع."
                  : "Deposit and withdrawal flows expose the current state, next step, and expected delay."}
              </p>
              <p>
                {locale === "ar"
                  ? "تبقى معرفات المراجع والطوابع الزمنية مرئية عندما تهم الثقة."
                  : "Reference IDs and timestamps stay visible wherever traceability matters."}
              </p>
              <p>
                {locale === "ar"
                  ? "يتم شرح التأخير الطبيعي على السلسلة باعتباره وقت تسوية، لا خطأ."
                  : "Normal blockchain delay is explained as settlement time, not generic failure."}
              </p>
            </div>
          </Card>
        </section>
      </div>
    </Layout>
  );
};

export default Index;
