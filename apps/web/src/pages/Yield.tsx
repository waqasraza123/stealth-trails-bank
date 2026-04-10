import { useState } from "react";
import {
  Database,
  ShieldAlert,
  Sparkles,
  Wallet
} from "lucide-react";
import { Layout } from "@/components/Layout";
import { StatusBadge } from "@/components/customer/StatusBadge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocale } from "@/i18n/use-locale";
import { useT } from "@/i18n/use-t";
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

const Yield = () => {
  const t = useT();
  const { locale } = useLocale();
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
  const executionPending =
    depositMutation.isPending ||
    withdrawalMutation.isPending ||
    claimRewardMutation.isPending ||
    emergencyWithdrawalMutation.isPending;

  async function handleDeposit(pool: CustomerStakingPoolSnapshot) {
    if (!isPositiveDecimalString(depositAmount)) {
      toast({
        variant: "destructive",
        title: t("staking.invalidDepositTitle"),
        description: t("staking.invalidDepositDescription")
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
        title: t("staking.depositSuccessTitle"),
        description: t("staking.txHashPrefix", { hash: result.transactionHash })
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: t("staking.depositErrorTitle"),
        description: error instanceof Error ? error.message : t("staking.requestFailed")
      });
    }
  }

  async function handleWithdrawal(pool: CustomerStakingPoolSnapshot) {
    if (!isPositiveDecimalString(withdrawAmount)) {
      toast({
        variant: "destructive",
        title: t("staking.invalidWithdrawTitle"),
        description: t("staking.invalidWithdrawDescription")
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
        title: t("staking.withdrawSuccessTitle"),
        description: t("staking.txHashPrefix", { hash: result.transactionHash })
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: t("staking.withdrawErrorTitle"),
        description: error instanceof Error ? error.message : t("staking.requestFailed")
      });
    }
  }

  async function handleClaimReward(pool: CustomerStakingPoolSnapshot) {
    try {
      const result = await claimRewardMutation.mutateAsync({
        poolId: pool.id
      });
      toast({
        title: t("staking.claimSuccessTitle"),
        description: t("staking.txHashPrefix", { hash: result.transactionHash })
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: t("staking.claimErrorTitle"),
        description: error instanceof Error ? error.message : t("staking.requestFailed")
      });
    }
  }

  async function handleEmergencyWithdrawal(pool: CustomerStakingPoolSnapshot) {
    try {
      const result = await emergencyWithdrawalMutation.mutateAsync({
        poolId: pool.id
      });
      toast({
        title: t("staking.emergencySuccessTitle"),
        description: t("staking.txHashPrefix", { hash: result.transactionHash })
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: t("staking.emergencyErrorTitle"),
        description: error instanceof Error ? error.message : t("staking.requestFailed")
      });
    }
  }

  return (
    <Layout>
      <div className="space-y-6">
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_380px]">
          <Card className="stb-surface rounded-[2rem] border-0 p-6">
            <div className="space-y-4">
              <div>
                <p className="stb-section-kicker">
                  {locale === "ar" ? "العائد" : "Yield"}
                </p>
                <h1 className="stb-page-title mt-2 text-3xl font-semibold text-slate-950">
                  {locale === "ar" ? "العائد والبنية التحتية" : "Yield and infrastructure"}
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                  {locale === "ar"
                    ? "يُعرض المنتج كخدمة خاضعة للحالة والحوكمة، مع إبقاء الأهلية والتنفيذ والمخاطر مرئية قبل أي إجراء."
                    : "The product is framed as a governed, stateful service with eligibility, execution, and risk kept visible before any action."}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-[1.4rem] bg-white/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {locale === "ar" ? "المجمعات" : "Pools"}
                  </p>
                  <p className="mt-3 text-3xl font-semibold text-slate-950">
                    {stakingQuery.isLoading ? "..." : pools.length}
                  </p>
                </div>
                <div className="rounded-[1.4rem] bg-white/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {locale === "ar" ? "محفظة الدفع" : "Payout wallet"}
                  </p>
                  <p className="stb-ref mt-3 text-sm font-medium text-slate-950">
                    <bdi>{formatShortAddress(user?.ethereumAddress, t("shared.notAvailable"))}</bdi>
                  </p>
                </div>
                <div className="rounded-[1.4rem] bg-slate-950 p-4 text-white">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">
                    {locale === "ar" ? "قابلية التنفيذ" : "Execution"}
                  </p>
                  <p className="mt-3 text-sm font-semibold text-white">
                    {executionEnabled
                      ? locale === "ar"
                        ? "مفعّل"
                        : "Enabled"
                      : locale === "ar"
                        ? "مقيد"
                        : "Policy-gated"}
                  </p>
                </div>
              </div>

              <div
                className={`rounded-[1.5rem] p-5 ${
                  executionEnabled ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <ShieldAlert className="h-4 w-4" />
                  {executionEnabled
                    ? locale === "ar"
                      ? "التنفيذ المُدار متاح"
                      : "Managed execution available"
                    : locale === "ar"
                      ? "التنفيذ مُقيد بسياسة"
                      : "Execution remains policy-gated"}
                </div>
                <p className="mt-2 text-sm leading-7">
                  {snapshot?.execution.message ??
                    (locale === "ar"
                      ? "يجري تحميل حالة التنفيذ."
                      : "Execution status is loading.")}
                </p>
              </div>

              {snapshot && !snapshot.readModel.available ? (
                <div className="rounded-[1.5rem] bg-slate-100 p-5 text-slate-800">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Database className="h-4 w-4" />
                    {t("staking.readModelLimitedTitle")}
                  </div>
                  <p className="mt-2 text-sm leading-7">{snapshot.readModel.message}</p>
                </div>
              ) : null}
            </div>
          </Card>

          <Card className="stb-surface rounded-[2rem] border-0 p-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Sparkles className="h-4 w-4 text-indigo-700" />
              {locale === "ar" ? "وضع المنتج" : "Product posture"}
            </div>
            <div className="mt-5 space-y-4 text-sm leading-7 text-slate-600">
              <p>
                {locale === "ar"
                  ? "لا يتم عرض هذا المنتج كدعوة سريعة للعائد. تظهر الشروط والحالة قبل الأفعال."
                  : "This product is not presented as a rush-to-yield surface. Conditions and state come before actions."}
              </p>
              <p>
                {locale === "ar"
                  ? "قد تكون بعض الإمكانات مقيدة وفق إعدادات التنفيذ الخلفية."
                  : "Some capabilities may remain gated by backend execution posture."}
              </p>
            </div>
          </Card>
        </section>

        {stakingQuery.isError ? (
          <Card className="rounded-[1.6rem] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {stakingQuery.error instanceof Error
              ? stakingQuery.error.message
              : t("staking.snapshotError")}
          </Card>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="stb-surface rounded-[2rem] border-0 p-5">
            <h2 className="text-lg font-semibold text-slate-950">
              {locale === "ar" ? "المجمعات المدرجة" : "Listed pools"}
            </h2>
            <div className="mt-5 space-y-3">
              {stakingQuery.isLoading ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-24 animate-pulse rounded-[1.2rem] bg-slate-200" />
                ))
              ) : pools.length > 0 ? (
                pools.map((pool) => (
                  <button
                    key={pool.id}
                    type="button"
                    className={`w-full rounded-[1.3rem] border p-4 text-left transition-colors ${
                      selectedPool?.id === pool.id
                        ? "border-slate-950 bg-slate-950 text-white"
                        : "border-slate-200 bg-white/80 text-slate-950 hover:bg-white"
                    }`}
                    onClick={() => setSelectedPoolId(pool.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">
                          {locale === "ar" ? `المجمع #${pool.id}` : `Pool #${pool.id}`}
                        </p>
                        <p className="mt-1 text-sm opacity-75">
                          {pool.rewardRate}% APR
                        </p>
                      </div>
                      <StatusBadge
                        label={pool.poolStatus}
                        tone={pool.poolStatus === "active" ? "positive" : "warning"}
                        className={
                          selectedPool?.id === pool.id
                            ? "!bg-white/12 !text-white before:!bg-white/70"
                            : undefined
                        }
                      />
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-[1.2rem] border border-dashed border-slate-300 p-4 text-sm text-slate-600">
                  {t("staking.noPools")}
                </div>
              )}
            </div>
          </Card>

          {selectedPool ? (
            <Card className="stb-surface rounded-[2rem] border-0 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-950">
                    {locale === "ar" ? `المجمع #${selectedPool.id}` : `Pool #${selectedPool.id}`}
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">
                    {locale === "ar"
                      ? "سياق المنتج، والأهلية، والحالة الحالية للمركز."
                      : "Product context, eligibility, and current position state."}
                  </p>
                </div>
                <StatusBadge
                  label={selectedPool.poolStatus}
                  tone={selectedPool.poolStatus === "active" ? "positive" : "warning"}
                />
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[1.4rem] bg-white/80 p-4">
                  <p className="text-sm text-slate-500">{t("staking.rewardRate")}</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    {selectedPool.rewardRate}%
                  </p>
                </div>
                <div className="rounded-[1.4rem] bg-white/80 p-4">
                  <p className="text-sm text-slate-500">{t("staking.totalStaked")}</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    {formatTokenAmount(selectedPool.totalStakedAmount, locale, 4)} ETH
                  </p>
                </div>
                <div className="rounded-[1.4rem] bg-white/80 p-4">
                  <p className="text-sm text-slate-500">{t("staking.yourStake")}</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    {formatTokenAmount(selectedPool.position.stakedBalance, locale, 4)} ETH
                  </p>
                </div>
                <div className="rounded-[1.4rem] bg-white/80 p-4">
                  <p className="text-sm text-slate-500">{t("staking.pendingRewards")}</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    {formatTokenAmount(selectedPool.position.pendingReward, locale, 4)} ETH
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-6 xl:grid-cols-2">
                <div className="rounded-[1.5rem] border border-slate-200 bg-white/80 p-5">
                  <h3 className="text-lg font-semibold text-slate-950">
                    {locale === "ar" ? "زيادة المركز" : "Increase position"}
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    {locale === "ar"
                      ? "يتم تنفيذ الإيداعات عبر مسار تشغيل مُدار عندما تسمح السياسة."
                      : "Deposits move through a managed operational path when policy allows."}
                  </p>
                  <div className="mt-4 space-y-3">
                    <label className="text-sm font-medium text-slate-700" htmlFor="yield-deposit-amount">
                      {locale === "ar" ? "مبلغ الإيداع" : "Deposit amount"}
                    </label>
                    <Input
                      id="yield-deposit-amount"
                      value={depositAmount}
                      onChange={(event) => setDepositAmount(event.target.value)}
                      placeholder={t("staking.depositPlaceholder")}
                      className="h-12 rounded-2xl bg-white"
                    />
                    <Button
                      className="h-12 w-full rounded-2xl bg-slate-950 text-white hover:bg-slate-900"
                      disabled={!executionEnabled || executionPending}
                      onClick={() => void handleDeposit(selectedPool)}
                    >
                      {locale === "ar" ? "إضافة ETH" : "Stake ETH"}
                    </Button>
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-slate-200 bg-white/80 p-5">
                  <h3 className="text-lg font-semibold text-slate-950">
                    {locale === "ar" ? "خفض المركز" : "Reduce position"}
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    {locale === "ar"
                      ? "السحب يخضع لنفس الضوابط التنفيذية ويظل مرئياً ضمن حالة المنتج."
                      : "Withdrawals follow the same execution controls and stay visible in product state."}
                  </p>
                  <div className="mt-4 space-y-3">
                    <label className="text-sm font-medium text-slate-700" htmlFor="yield-withdraw-amount">
                      {locale === "ar" ? "مبلغ السحب" : "Withdrawal amount"}
                    </label>
                    <Input
                      id="yield-withdraw-amount"
                      value={withdrawAmount}
                      onChange={(event) => setWithdrawAmount(event.target.value)}
                      placeholder={t("staking.withdrawPlaceholder")}
                      className="h-12 rounded-2xl bg-white"
                    />
                    <Button
                      variant="outline"
                      className="h-12 w-full rounded-2xl border-slate-300 bg-white"
                      disabled={!executionEnabled || executionPending}
                      onClick={() => void handleWithdrawal(selectedPool)}
                    >
                      {locale === "ar" ? "سحب الحصة" : "Withdraw stake"}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  className="rounded-full border-slate-300 bg-white"
                  disabled={!executionEnabled || executionPending}
                  onClick={() => void handleClaimReward(selectedPool)}
                >
                  {locale === "ar" ? "تحصيل المكافآت" : "Claim rewards"}
                </Button>
                <Button
                  variant="outline"
                  className="rounded-full border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                  disabled={!executionEnabled || executionPending}
                  onClick={() => void handleEmergencyWithdrawal(selectedPool)}
                >
                  {locale === "ar" ? "سحب طارئ" : "Emergency withdrawal"}
                </Button>
              </div>

              {!executionEnabled ? (
                <p className="mt-4 text-sm leading-7 text-slate-600">
                  {locale === "ar"
                    ? "التنفيذ معطل حالياً من الخلفية أو من وضع المحفظة المُدارة."
                    : "Execution is currently disabled by backend policy or managed wallet posture."}
                </p>
              ) : null}

              <div className="mt-6 flex items-center gap-2 text-sm text-slate-500">
                <Wallet className="h-4 w-4" />
                <span>
                  {t("staking.payoutWallet")}:{" "}
                  <span className="stb-ref font-medium text-slate-900">
                    <bdi>{snapshot?.walletAddress ?? t("shared.notAvailable")}</bdi>
                  </span>
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-500">
                {t("staking.lastUpdated")}: {formatDateLabel(selectedPool.updatedAt, locale)}
              </p>
            </Card>
          ) : null}
        </section>
      </div>
    </Layout>
  );
};

export default Yield;
