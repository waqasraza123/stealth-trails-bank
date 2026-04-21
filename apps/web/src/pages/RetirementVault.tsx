import { Link } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Landmark,
  LockKeyhole,
  ShieldAlert,
  ShieldCheck
} from "lucide-react";
import { Layout } from "@/components/Layout";
import { MotionSurface, ScreenTransition } from "@/components/motion/primitives";
import { StatusBadge } from "@/components/customer/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LoadingButton } from "@/components/ui/loading-button";
import { toast } from "@/components/ui/use-toast";
import { useSupportedAssets } from "@/hooks/assets/useSupportedAssets";
import { useMyBalances } from "@/hooks/balances/useMyBalances";
import {
  useCreateRetirementVault,
  type CreateMyRetirementVaultResult
} from "@/hooks/retirement-vault/useCreateRetirementVault";
import {
  useFundRetirementVault,
  type FundMyRetirementVaultResult
} from "@/hooks/retirement-vault/useFundRetirementVault";
import { useCancelRetirementVaultRelease } from "@/hooks/retirement-vault/useCancelRetirementVaultRelease";
import { useCancelRetirementVaultRuleChange } from "@/hooks/retirement-vault/useCancelRetirementVaultRuleChange";
import { useMyRetirementVaults } from "@/hooks/retirement-vault/useMyRetirementVaults";
import { useRequestRetirementVaultRelease } from "@/hooks/retirement-vault/useRequestRetirementVaultRelease";
import { useRequestRetirementVaultRuleChange } from "@/hooks/retirement-vault/useRequestRetirementVaultRuleChange";
import { useLocale } from "@/i18n/use-locale";
import {
  buildRequestIdempotencyKey,
  formatDateLabel,
  formatIntentAmount,
  formatIntentStatusLabel,
  formatTokenAmount,
  getIntentConfidenceStatus,
  isPositiveDecimalString
} from "@/lib/customer-finance";
import { readApiErrorMessage } from "@/lib/api";
import { getTransactionConfidenceTone } from "@stealth-trails-bank/ui-foundation";

function getDefaultUnlockDateValue(): string {
  const future = new Date();
  future.setUTCFullYear(future.getUTCFullYear() + 10);
  return future.toISOString().slice(0, 10);
}

function dateValueToIsoString(value: string): string {
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

function isActiveReleaseStatus(status: string): boolean {
  return [
    "requested",
    "review_required",
    "approved",
    "cooldown_active",
    "ready_for_release",
    "executing"
  ].includes(status);
}

function canCancelReleaseStatus(status: string): boolean {
  return ["requested", "review_required", "approved", "cooldown_active"].includes(
    status
  );
}

function isActiveRuleChangeStatus(status: string): boolean {
  return [
    "review_required",
    "cooldown_active",
    "ready_to_apply",
    "applying",
  ].includes(status);
}

function canCancelRuleChangeStatus(status: string): boolean {
  return ["review_required", "cooldown_active"].includes(status);
}

const RetirementVault = () => {
  const { locale } = useLocale();
  const balancesQuery = useMyBalances();
  const supportedAssetsQuery = useSupportedAssets();
  const retirementVaultsQuery = useMyRetirementVaults();
  const createRetirementVault = useCreateRetirementVault();
  const fundRetirementVault = useFundRetirementVault();
  const requestRetirementVaultRelease = useRequestRetirementVaultRelease();
  const cancelRetirementVaultRelease = useCancelRetirementVaultRelease();
  const requestRetirementVaultRuleChange = useRequestRetirementVaultRuleChange();
  const cancelRetirementVaultRuleChange = useCancelRetirementVaultRuleChange();
  const [createAssetSymbol, setCreateAssetSymbol] = useState("");
  const [fundAssetSymbol, setFundAssetSymbol] = useState("");
  const [releaseAssetSymbol, setReleaseAssetSymbol] = useState("");
  const [unlockDate, setUnlockDate] = useState(getDefaultUnlockDateValue);
  const [strictMode, setStrictMode] = useState(true);
  const [fundAmount, setFundAmount] = useState("");
  const [releaseAmount, setReleaseAmount] = useState("");
  const [ruleChangeAssetSymbol, setRuleChangeAssetSymbol] = useState("");
  const [ruleChangeUnlockDate, setRuleChangeUnlockDate] = useState("");
  const [ruleChangeStrictMode, setRuleChangeStrictMode] = useState(true);
  const [ruleChangeReasonCode, setRuleChangeReasonCode] = useState("future_lock_reset");
  const [ruleChangeReasonNote, setRuleChangeReasonNote] = useState("");
  const [releaseReasonCode, setReleaseReasonCode] = useState("hardship");
  const [releaseReasonNote, setReleaseReasonNote] = useState("");
  const [releaseEvidenceNote, setReleaseEvidenceNote] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [fundError, setFundError] = useState<string | null>(null);
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [ruleChangeError, setRuleChangeError] = useState<string | null>(null);
  const [latestCreatedVault, setLatestCreatedVault] =
    useState<CreateMyRetirementVaultResult | null>(null);
  const [latestFunding, setLatestFunding] =
    useState<FundMyRetirementVaultResult | null>(null);
  const lastFundingRef = useRef<{
    signature: string;
    idempotencyKey: string;
  } | null>(null);

  const vaults = retirementVaultsQuery.data?.vaults ?? [];
  const balances = balancesQuery.data?.balances ?? [];
  const supportedAssets = supportedAssetsQuery.data?.assets ?? [];
  const selectedCreateAssetSymbol =
    supportedAssets.find((asset) => asset.symbol === createAssetSymbol)?.symbol ??
    supportedAssets[0]?.symbol ??
    "";
  const selectedFundAssetSymbol =
    vaults.find((vault) => vault.asset.symbol === fundAssetSymbol)?.asset.symbol ??
    vaults[0]?.asset.symbol ??
    "";
  const selectedReleaseAssetSymbol =
    vaults.find((vault) => vault.asset.symbol === releaseAssetSymbol)?.asset.symbol ??
    vaults[0]?.asset.symbol ??
    "";
  const selectedFundBalance =
    balances.find((balance) => balance.asset.symbol === selectedFundAssetSymbol) ??
    null;
  const selectedReleaseVault =
    vaults.find((vault) => vault.asset.symbol === selectedReleaseAssetSymbol) ?? null;
  const selectedRuleChangeAssetSymbol =
    vaults.find((vault) => vault.asset.symbol === ruleChangeAssetSymbol)?.asset.symbol ??
    vaults[0]?.asset.symbol ??
    "";
  const selectedRuleChangeVault =
    vaults.find((vault) => vault.asset.symbol === selectedRuleChangeAssetSymbol) ?? null;
  const totalLockedBalance = useMemo(
    () =>
      vaults.reduce(
        (sum, vault) => sum + Number.parseFloat(vault.lockedBalance || "0"),
        0
      ),
    [vaults]
  );
  const nextUnlockAt = vaults
    .map((vault) => vault.unlockAt)
    .sort((left, right) => Date.parse(left) - Date.parse(right))[0];
  const activeReleaseRequests = useMemo(
    () =>
      vaults
        .flatMap((vault) =>
          vault.releaseRequests.map((request) => ({
            ...request,
            asset: vault.asset
          }))
        )
        .filter((request) => isActiveReleaseStatus(request.status))
        .sort(
          (left, right) =>
            Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
        ),
    [vaults]
  );
  const activeRuleChangeRequests = useMemo(
    () =>
      vaults
        .flatMap((vault) =>
          vault.ruleChangeRequests.map((request) => ({
            ...request,
            asset: vault.asset,
          })),
        )
        .filter((request) => isActiveRuleChangeStatus(request.status))
        .sort(
          (left, right) =>
            Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
        ),
    [vaults],
  );

  useEffect(() => {
    if (!selectedRuleChangeVault) {
      return;
    }

    setRuleChangeUnlockDate(selectedRuleChangeVault.unlockAt.slice(0, 10));
    setRuleChangeStrictMode(selectedRuleChangeVault.strictMode);
  }, [selectedRuleChangeVault?.id]);

  function getFundingIdempotencyKey(signature: string): string {
    if (lastFundingRef.current?.signature === signature) {
      return lastFundingRef.current.idempotencyKey;
    }

    const idempotencyKey = buildRequestIdempotencyKey("vault_fund_req");
    lastFundingRef.current = {
      signature,
      idempotencyKey
    };

    return idempotencyKey;
  }

  async function handleCreateVault(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedCreateAssetSymbol) {
      setCreateError(
        locale === "ar"
          ? "اختر أصلاً قبل إنشاء القبو."
          : "Select an asset before creating the vault."
      );
      return;
    }

    if (!unlockDate) {
      setCreateError(
        locale === "ar"
          ? "حدد تاريخ الإفراج قبل المتابعة."
          : "Select a release date before continuing."
      );
      return;
    }

    setCreateError(null);

    try {
      const result = await createRetirementVault.mutateAsync({
        assetSymbol: selectedCreateAssetSymbol,
        unlockAt: dateValueToIsoString(unlockDate),
        strictMode
      });

      setLatestCreatedVault(result);
      setFundAssetSymbol(result.vault.asset.symbol);

      toast({
        title:
          locale === "ar"
            ? result.created
              ? "تم إنشاء قبو التقاعد"
              : "القبو موجود بالفعل"
            : result.created
              ? "Retirement Vault created"
              : "Retirement Vault already exists",
        description:
          locale === "ar"
            ? result.created
              ? "القبو الآن جاهز لاستقبال الأموال المقفلة من رصيدك المتاح."
              : "يمكنك تمويل القبو الحالي من هذا الأصل الآن."
            : result.created
              ? "The vault is ready to receive locked funds from your available balance."
              : "You can fund the existing vault for this asset now."
      });
    } catch (error) {
      const message = readApiErrorMessage(
        error,
        locale === "ar"
          ? "تعذر إنشاء قبو التقاعد."
          : "Failed to create the retirement vault."
      );
      setCreateError(message);
    }
  }

  async function handleFundVault(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedAmount = fundAmount.trim();

    if (!selectedFundAssetSymbol) {
      setFundError(
        locale === "ar"
          ? "أنشئ قبو تقاعد أولاً ثم موّله."
          : "Create a retirement vault first, then fund it."
      );
      return;
    }

    if (!isPositiveDecimalString(normalizedAmount)) {
      setFundError(
        locale === "ar"
          ? "أدخل مبلغاً موجباً صالحاً للتمويل."
          : "Enter a valid positive amount to fund."
      );
      return;
    }

    if (
      selectedFundBalance &&
      Number.parseFloat(normalizedAmount) >
        Number.parseFloat(selectedFundBalance.availableBalance)
    ) {
      setFundError(
        locale === "ar"
          ? "المبلغ يتجاوز الرصيد المتاح لهذا الأصل."
          : "Amount exceeds the available balance for this asset."
      );
      return;
    }

    setFundError(null);

    const signature = JSON.stringify({
      assetSymbol: selectedFundAssetSymbol,
      amount: normalizedAmount
    });

    try {
      const result = await fundRetirementVault.mutateAsync({
        idempotencyKey: getFundingIdempotencyKey(signature),
        assetSymbol: selectedFundAssetSymbol,
        amount: normalizedAmount
      });

      setLatestFunding(result);
      setFundAmount("");
      lastFundingRef.current = null;

      toast({
        title:
          locale === "ar"
            ? result.idempotencyReused
              ? "تمت إعادة استخدام طلب التمويل"
              : "تم تمويل قبو التقاعد"
            : result.idempotencyReused
              ? "Vault funding request reused"
              : "Retirement Vault funded",
        description:
          locale === "ar"
            ? "تم نقل الأموال من الرصيد السائل إلى الرصيد المقفل داخل القبو."
            : "Funds were moved from liquid balance into the locked vault balance."
      });
    } catch (error) {
      const message = readApiErrorMessage(
        error,
        locale === "ar"
          ? "تعذر تمويل قبو التقاعد."
          : "Failed to fund the retirement vault."
      );
      setFundError(message);
    }
  }

  async function handleRequestRelease(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const normalizedAmount = releaseAmount.trim();

    if (!selectedReleaseVault) {
      setReleaseError(
        locale === "ar"
          ? "أنشئ قبو تقاعد وموله أولاً."
          : "Create and fund a retirement vault first."
      );
      return;
    }

    if (!isPositiveDecimalString(normalizedAmount)) {
      setReleaseError(
        locale === "ar"
          ? "أدخل مبلغ إفراج صالحاً."
          : "Enter a valid release amount."
      );
      return;
    }

    if (
      Number.parseFloat(normalizedAmount) >
      Number.parseFloat(selectedReleaseVault.lockedBalance)
    ) {
      setReleaseError(
        locale === "ar"
          ? "المبلغ يتجاوز الرصيد المقفل في هذا القبو."
          : "Amount exceeds the locked balance in this vault."
      );
      return;
    }

    setReleaseError(null);

    try {
      const result = await requestRetirementVaultRelease.mutateAsync({
        assetSymbol: selectedReleaseVault.asset.symbol,
        amount: normalizedAmount,
        reasonCode:
          new Date(selectedReleaseVault.unlockAt) > new Date()
            ? releaseReasonCode
            : undefined,
        reasonNote: releaseReasonNote.trim() || undefined,
        evidenceNote: releaseEvidenceNote.trim() || undefined
      });

      setReleaseAmount("");
      setReleaseReasonNote("");
      setReleaseEvidenceNote("");

      toast({
        title:
          locale === "ar"
            ? "تم تسجيل طلب الإفراج"
            : "Governed release requested",
        description:
          result.releaseRequest.status === "review_required"
            ? locale === "ar"
              ? "الإفراج المبكر دخل مسار مراجعة إلزامي قبل بدء التهدئة."
              : "Early unlock entered a mandatory review path before cooldown begins."
            : locale === "ar"
              ? "تم فتح نافذة التهدئة قبل إعادة المال إلى الرصيد السائل."
              : "A cooldown window is now open before funds return to liquid balance."
      });
    } catch (error) {
      const message = readApiErrorMessage(
        error,
        locale === "ar"
          ? "تعذر تسجيل طلب الإفراج."
          : "Failed to request governed release."
      );
      setReleaseError(message);
    }
  }

  async function handleCancelRelease(releaseRequestId: string) {
    try {
      await cancelRetirementVaultRelease.mutateAsync(releaseRequestId);
      toast({
        title:
          locale === "ar"
            ? "تم إلغاء طلب الإفراج"
            : "Unlock request cancelled",
        description:
          locale === "ar"
            ? "تمت إزالة الطلب من المسار النشط."
            : "The request was removed from the active workflow."
      });
    } catch (error) {
      toast({
        title:
          locale === "ar"
            ? "فشل إلغاء الطلب"
            : "Failed to cancel unlock request",
        description: readApiErrorMessage(
          error,
          locale === "ar"
            ? "تعذر إلغاء طلب الإفراج."
            : "Could not cancel the unlock request."
        ),
        variant: "destructive"
      });
    }
  }

  async function handleRequestRuleChange(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!selectedRuleChangeVault) {
      setRuleChangeError(
        locale === "ar"
          ? "أنشئ قبو تقاعد أولاً."
          : "Create a retirement vault first.",
      );
      return;
    }

    const nextUnlockAt = ruleChangeUnlockDate
      ? dateValueToIsoString(ruleChangeUnlockDate)
      : undefined;
    const weakensProtection =
      (nextUnlockAt &&
        new Date(nextUnlockAt).getTime() <
          new Date(selectedRuleChangeVault.unlockAt).getTime()) ||
      (selectedRuleChangeVault.strictMode && !ruleChangeStrictMode);

    setRuleChangeError(null);

    try {
      const result = await requestRetirementVaultRuleChange.mutateAsync({
        assetSymbol: selectedRuleChangeVault.asset.symbol,
        unlockAt: nextUnlockAt,
        strictMode: ruleChangeStrictMode,
        reasonCode: weakensProtection ? ruleChangeReasonCode : undefined,
        reasonNote: ruleChangeReasonNote.trim() || undefined,
      });

      toast({
        title:
          locale === "ar"
            ? "تم تسجيل تعديل القاعدة"
            : "Rule change recorded",
        description: result.appliedImmediately
          ? locale === "ar"
            ? "تم تطبيق التشديد الوقائي فوراً على القبو."
            : "The protective strengthening was applied immediately."
          : locale === "ar"
            ? "تعديل القاعدة المُضعِف للحماية دخل مسار مراجعة وتهدئة محكوم."
            : "The protection-weakening change entered governed review and cooldown.",
      });
    } catch (error) {
      setRuleChangeError(
        readApiErrorMessage(
          error,
          locale === "ar"
            ? "تعذر تسجيل تعديل القاعدة."
            : "Failed to request the vault rule change.",
        ),
      );
    }
  }

  async function handleCancelRuleChange(ruleChangeRequestId: string) {
    try {
      await cancelRetirementVaultRuleChange.mutateAsync(ruleChangeRequestId);
      toast({
        title:
          locale === "ar" ? "تم إلغاء تعديل القاعدة" : "Rule change cancelled",
        description:
          locale === "ar"
            ? "تمت إزالة تعديل القاعدة من المسار النشط."
            : "The rule change was removed from the active governance workflow.",
      });
    } catch (error) {
      toast({
        title:
          locale === "ar"
            ? "فشل إلغاء تعديل القاعدة"
            : "Failed to cancel rule change",
        description: readApiErrorMessage(
          error,
          locale === "ar"
            ? "تعذر إلغاء تعديل القاعدة."
            : "Could not cancel the rule change request.",
        ),
        variant: "destructive",
      });
    }
  }

  const latestFundingConfidence = latestFunding
    ? getIntentConfidenceStatus(latestFunding.intent.status)
    : null;

  return (
    <Layout>
      <ScreenTransition className="stb-page-stack">
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          <MotionSurface className="stb-pressable-shell">
            <Card className="stb-surface stb-reveal overflow-hidden rounded-[2rem] border-0 p-6">
              <div className="space-y-5">
                <div className="space-y-3">
                  <p className="stb-section-kicker">
                    {locale === "ar" ? "قبو التقاعد" : "Retirement Vault"}
                  </p>
                  <h1 className="stb-page-title text-3xl font-semibold text-slate-950">
                    {locale === "ar"
                      ? "حجرة أموال طويلة الأجل بإفراج محكوم"
                      : "A long-term money chamber with governed release"}
                  </h1>
                  <p className="max-w-3xl text-sm leading-7 text-slate-600">
                    {locale === "ar"
                      ? "الأموال داخل هذا القبو لا تبقى في الرصيد السائل. يتم قفلها، تتبعها بشكل منفصل، ولا تعود إلا عبر مسار إفراج محكوم."
                      : "Funds inside this vault no longer sit in liquid balance. They are locked, tracked separately, and only return through a governed release path."}
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="stb-section-frame p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {locale === "ar" ? "الأموال المقفلة" : "Locked funds"}
                    </p>
                    <p className="mt-3 text-3xl font-semibold text-slate-950">
                      {formatTokenAmount(String(totalLockedBalance), locale)}
                    </p>
                  </div>
                  <div className="stb-section-frame p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {locale === "ar" ? "الأصول المحمية" : "Protected assets"}
                    </p>
                    <p className="mt-3 text-3xl font-semibold text-slate-950">
                      {vaults.length}
                    </p>
                  </div>
                  <div className="rounded-[1.4rem] bg-slate-950 p-4 text-white">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">
                      {locale === "ar" ? "أقرب إفراج" : "Next governed release"}
                    </p>
                    <p className="mt-3 text-base font-semibold">
                      {nextUnlockAt
                        ? formatDateLabel(nextUnlockAt, locale)
                        : locale === "ar"
                          ? "لا يوجد بعد"
                          : "Not scheduled yet"}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1.5rem] border border-emerald-200/80 bg-emerald-50/70 p-5">
                    <div className="flex items-center gap-2 text-sm font-semibold text-emerald-950">
                      <ShieldCheck className="h-4 w-4" />
                      {locale === "ar" ? "وضع الحماية" : "Protection mode"}
                    </div>
                    <p className="mt-3 text-sm leading-7 text-emerald-900/80">
                      {locale === "ar"
                        ? "السحب العادي لا يلمس أموال القبو. الرصيد المقفل يبقى خارج مسار السحب اليومي."
                        : "Ordinary withdrawals do not touch vault funds. Locked balance stays outside the daily withdrawal path."}
                    </p>
                  </div>
                  <div className="rounded-[1.5rem] border border-amber-200/80 bg-amber-50/80 p-5">
                    <div className="flex items-center gap-2 text-sm font-semibold text-amber-950">
                      <ShieldAlert className="h-4 w-4" />
                      {locale === "ar" ? "الإفراج المبكر" : "Early release"}
                    </div>
                    <p className="mt-3 text-sm leading-7 text-amber-900/80">
                      {locale === "ar"
                        ? "الإفراج المبكر يمر الآن عبر مراجعة إلزامية ونافذة تهدئة واضحة قبل إعادة أي مال إلى الرصيد السائل."
                        : "Early release now moves through mandatory review and a visible cooldown window before any money returns to liquid balance."}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </MotionSurface>

          <MotionSurface className="stb-pressable-shell">
            <Card className="stb-surface stb-reveal rounded-[2rem] border-0 p-6" data-delay="1">
              <div className="space-y-4">
                <div>
                  <p className="stb-section-kicker">
                    {locale === "ar" ? "المسار الحالي" : "Current phase"}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                      {locale === "ar"
                      ? "الإنشاء والتمويل وطلب الإفراج"
                      : "Create, fund, and request release"}
                  </h2>
                </div>
                <div className="rounded-[1.5rem] bg-slate-950 p-5 text-white">
                  <div className="flex items-center gap-2">
                    <LockKeyhole className="h-4 w-4 text-emerald-300" />
                    <p className="text-sm font-semibold">
                      {locale === "ar"
                        ? "قفل طويل الأجل بإفراج لاحق"
                        : "Long-term lock with later governed release"}
                    </p>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-white/72">
                      {locale === "ar"
                      ? "ابدأ بإنشاء القبو وتمويله، ثم افتح طلب الإفراج الطبيعي أو المبكر عبر هذا السطح نفسه."
                      : "Create and fund the vault first, then open either a normal or early release request from this same surface."}
                  </p>
                  <Button asChild className="mt-5 rounded-full bg-white text-slate-950 hover:bg-white/92">
                    <Link to="/wallet">
                      {locale === "ar" ? "مراجعة الرصيد السائل" : "Review liquid balance"}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </Card>
          </MotionSurface>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <MotionSurface className="stb-pressable-shell">
            <Card className="stb-surface stb-reveal rounded-[2rem] border-0 p-6" data-delay="2">
              <form className="space-y-5" onSubmit={handleCreateVault}>
                <div>
                  <p className="stb-section-kicker">
                    {locale === "ar" ? "إنشاء القبو" : "Create vault"}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                    {locale === "ar"
                      ? "ثبت القاعدة قبل قفل المال"
                      : "Set the rule before locking the money"}
                  </h2>
                </div>

                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-slate-700">
                    {locale === "ar" ? "الأصل" : "Asset"}
                  </span>
                  <select
                    className="stb-premium-input"
                    value={selectedCreateAssetSymbol}
                    onChange={(event) => setCreateAssetSymbol(event.target.value)}
                  >
                    {supportedAssets.map((asset) => (
                      <option key={asset.id} value={asset.symbol}>
                        {asset.symbol} · {asset.displayName}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-slate-700">
                    {locale === "ar" ? "تاريخ الإفراج" : "Release date"}
                  </span>
                  <Input
                    min={new Date().toISOString().slice(0, 10)}
                    type="date"
                    value={unlockDate}
                    onChange={(event) => setUnlockDate(event.target.value)}
                  />
                </label>

                <div className="space-y-2">
                  <span className="text-sm font-semibold text-slate-700">
                    {locale === "ar" ? "شدة الحماية" : "Protection intensity"}
                  </span>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      className={`rounded-[1.2rem] border px-4 py-4 text-left transition-colors ${
                        strictMode
                          ? "border-slate-950 bg-slate-950 text-white"
                          : "border-slate-200 bg-white text-slate-800"
                      }`}
                      onClick={() => setStrictMode(true)}
                    >
                      <p className="text-sm font-semibold">
                        {locale === "ar" ? "وضع صارم" : "Strict mode"}
                      </p>
                      <p className={`mt-2 text-sm ${strictMode ? "text-white/70" : "text-slate-600"}`}>
                        {locale === "ar"
                          ? "لغة حماية أثقل وإفراج مقصود لاحقاً."
                          : "Heavier protection language and a more deliberate future release posture."}
                      </p>
                    </button>
                    <button
                      type="button"
                      className={`rounded-[1.2rem] border px-4 py-4 text-left transition-colors ${
                        strictMode
                          ? "border-slate-200 bg-white text-slate-800"
                          : "border-slate-950 bg-slate-950 text-white"
                      }`}
                      onClick={() => setStrictMode(false)}
                    >
                      <p className="text-sm font-semibold">
                        {locale === "ar" ? "وضع قياسي" : "Standard mode"}
                      </p>
                      <p className={`mt-2 text-sm ${strictMode ? "text-slate-600" : "text-white/70"}`}>
                        {locale === "ar"
                          ? "قفل واضح مع واجهة أخف."
                          : "Clear lock rules with a lighter presentation."}
                      </p>
                    </button>
                  </div>
                </div>

                {createError ? (
                  <div className="stb-trust-note text-sm text-red-700" data-tone="critical">
                    {createError}
                  </div>
                ) : null}

                <LoadingButton
                  className="w-full rounded-[1rem]"
                  isLoading={createRetirementVault.isPending}
                  type="submit"
                >
                  {locale === "ar" ? "إنشاء قبو التقاعد" : "Create Retirement Vault"}
                </LoadingButton>

                {latestCreatedVault ? (
                  <div className="rounded-[1.4rem] border border-slate-200 bg-white/75 p-4">
                    <p className="text-sm font-semibold text-slate-950">
                      {locale === "ar" ? "آخر قبو تم تأكيده" : "Latest confirmed vault"}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      {latestCreatedVault.vault.asset.displayName} ·{" "}
                      {formatDateLabel(latestCreatedVault.vault.unlockAt, locale)}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      {latestCreatedVault.vault.strictMode
                        ? locale === "ar"
                          ? "الوضع: صارم"
                          : "Mode: Strict"
                        : locale === "ar"
                          ? "الوضع: قياسي"
                          : "Mode: Standard"}
                    </p>
                  </div>
                ) : null}
              </form>
            </Card>
          </MotionSurface>

          <MotionSurface className="stb-pressable-shell">
            <Card className="stb-surface stb-reveal rounded-[2rem] border-0 p-6" data-delay="3">
              <form className="space-y-5" onSubmit={handleFundVault}>
                <div>
                  <p className="stb-section-kicker">
                    {locale === "ar" ? "تمويل القبو" : "Fund vault"}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                    {locale === "ar"
                      ? "انقل المال من السائل إلى المقفل"
                      : "Move money from liquid to locked"}
                  </h2>
                </div>

                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-slate-700">
                    {locale === "ar" ? "القبو" : "Vault asset"}
                  </span>
                  <select
                    className="stb-premium-input"
                    value={selectedFundAssetSymbol}
                    onChange={(event) => setFundAssetSymbol(event.target.value)}
                  >
                    {vaults.length > 0 ? (
                      vaults.map((vault) => (
                        <option key={vault.id} value={vault.asset.symbol}>
                          {vault.asset.symbol} · {formatTokenAmount(vault.lockedBalance, locale)} locked
                        </option>
                      ))
                    ) : (
                      <option value="">
                        {locale === "ar" ? "أنشئ قبو أولاً" : "Create a vault first"}
                      </option>
                    )}
                  </select>
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-slate-700">
                    {locale === "ar" ? "المبلغ" : "Amount"}
                  </span>
                  <Input
                    inputMode="decimal"
                    placeholder={locale === "ar" ? "0.00" : "0.00"}
                    value={fundAmount}
                    onChange={(event) => setFundAmount(event.target.value)}
                  />
                </label>

                <div className="rounded-[1.4rem] border border-slate-200 bg-white/80 p-4 text-sm text-slate-600">
                  <div className="flex items-center justify-between gap-3">
                    <span>{locale === "ar" ? "الرصيد المتاح" : "Available balance"}</span>
                    <span className="font-semibold text-slate-950">
                      {selectedFundBalance
                        ? `${formatTokenAmount(selectedFundBalance.availableBalance, locale)} ${selectedFundBalance.asset.symbol}`
                        : locale === "ar"
                          ? "غير متاح"
                          : "Not available"}
                    </span>
                  </div>
                </div>

                {fundError ? (
                  <div className="stb-trust-note text-sm text-red-700" data-tone="critical">
                    {fundError}
                  </div>
                ) : null}

                <LoadingButton
                  className="w-full rounded-[1rem]"
                  disabled={vaults.length === 0}
                  isLoading={fundRetirementVault.isPending}
                  type="submit"
                >
                  {locale === "ar" ? "تمويل القبو الآن" : "Fund vault now"}
                </LoadingButton>

                {latestFunding ? (
                  <div className="rounded-[1.4rem] border border-slate-200 bg-white/75 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">
                          {locale === "ar" ? "آخر حركة قفل" : "Latest lock movement"}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          {formatIntentAmount(
                            latestFunding.intent.settledAmount ??
                              latestFunding.intent.requestedAmount,
                            latestFunding.intent.asset.symbol,
                            latestFunding.intent.intentType,
                            locale
                          )}
                        </p>
                      </div>
                      <StatusBadge
                        className="shrink-0"
                        label={formatIntentStatusLabel(latestFunding.intent.status, locale)}
                        tone={getTransactionConfidenceTone(latestFundingConfidence ?? "technical")}
                      />
                    </div>
                  </div>
                ) : null}
              </form>
            </Card>
          </MotionSurface>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <MotionSurface className="stb-pressable-shell">
            <Card className="stb-surface stb-reveal rounded-[2rem] border-0 p-6" data-delay="4">
              <form className="space-y-5" onSubmit={handleRequestRelease}>
                <div>
                  <p className="stb-section-kicker">
                    {locale === "ar" ? "طلب الإفراج" : "Request release"}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                    {locale === "ar"
                      ? "افتح الإفراج عبر مسار محكوم"
                      : "Open release through a governed path"}
                  </h2>
                </div>

                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-slate-700">
                    {locale === "ar" ? "القبو" : "Vault asset"}
                  </span>
                  <select
                    className="stb-premium-input"
                    value={selectedReleaseAssetSymbol}
                    onChange={(event) => setReleaseAssetSymbol(event.target.value)}
                  >
                    {vaults.length > 0 ? (
                      vaults.map((vault) => (
                        <option key={vault.id} value={vault.asset.symbol}>
                          {vault.asset.symbol} · {formatTokenAmount(vault.lockedBalance, locale)} locked
                        </option>
                      ))
                    ) : (
                      <option value="">
                        {locale === "ar" ? "أنشئ قبو أولاً" : "Create a vault first"}
                      </option>
                    )}
                  </select>
                </label>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-slate-700">
                      {locale === "ar" ? "مبلغ الإفراج" : "Release amount"}
                    </span>
                    <Input
                      inputMode="decimal"
                      value={releaseAmount}
                      onChange={(event) => setReleaseAmount(event.target.value)}
                    />
                  </label>

                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-slate-700">
                      {locale === "ar" ? "سبب الإفراج المبكر" : "Early release reason"}
                    </span>
                    <select
                      className="stb-premium-input"
                      value={releaseReasonCode}
                      onChange={(event) => setReleaseReasonCode(event.target.value)}
                    >
                      <option value="hardship">
                        {locale === "ar" ? "ضائقة" : "Hardship"}
                      </option>
                      <option value="medical">
                        {locale === "ar" ? "طبي" : "Medical"}
                      </option>
                      <option value="family">
                        {locale === "ar" ? "عائلي" : "Family"}
                      </option>
                    </select>
                  </label>
                </div>

                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-slate-700">
                    {locale === "ar" ? "مذكرة الطلب" : "Request note"}
                  </span>
                  <Input
                    value={releaseReasonNote}
                    onChange={(event) => setReleaseReasonNote(event.target.value)}
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-slate-700">
                    {locale === "ar" ? "دليل أو شرح إضافي" : "Evidence or extra context"}
                  </span>
                  <Input
                    value={releaseEvidenceNote}
                    onChange={(event) => setReleaseEvidenceNote(event.target.value)}
                  />
                </label>

                <div className="stb-trust-note text-sm text-amber-900" data-tone="warning">
                  {selectedReleaseVault &&
                  new Date(selectedReleaseVault.unlockAt) > new Date()
                    ? locale === "ar"
                      ? "هذا إفراج مبكر. سيحتاج إلى مراجعة إلزامية ثم فترة تهدئة قبل التنفيذ."
                      : "This is an early unlock. It will require mandatory review and then a cooldown before execution."
                    : locale === "ar"
                      ? "هذا إفراج طبيعي بعد تحقق تاريخ القفل. سيبدأ مباشرة في نافذة تهدئة محكومة."
                      : "This is a normal unlock after the lock date. It will move directly into a governed cooldown window."}
                </div>

                {releaseError ? (
                  <div className="stb-trust-note text-sm text-red-700" data-tone="critical">
                    {releaseError}
                  </div>
                ) : null}

                <LoadingButton
                  className="w-full rounded-[1rem]"
                  disabled={vaults.length === 0}
                  isLoading={requestRetirementVaultRelease.isPending}
                  type="submit"
                >
                  {locale === "ar" ? "طلب الإفراج المحكوم" : "Request governed release"}
                </LoadingButton>
              </form>
            </Card>
          </MotionSurface>

          <MotionSurface className="stb-pressable-shell">
            <Card className="stb-surface stb-reveal rounded-[2rem] border-0 p-6" data-delay="5">
              <div className="space-y-4">
                <div>
                  <p className="stb-section-kicker">
                    {locale === "ar" ? "الطلبات النشطة" : "Active unlock requests"}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                    {locale === "ar"
                      ? "المراجعة والتهدئة والتنفيذ"
                      : "Review, cooldown, and release"}
                  </h2>
                </div>

                {activeReleaseRequests.length > 0 ? (
                  activeReleaseRequests.map((request) => (
                    <div
                      key={request.id}
                      className="rounded-[1.4rem] border border-slate-200 bg-white/80 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-950">
                            {request.asset.displayName}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            {formatTokenAmount(request.requestedAmount, locale)} {request.asset.symbol}
                          </p>
                        </div>
                        <StatusBadge
                          label={request.status.replaceAll("_", " ")}
                          tone={
                            request.status === "review_required" ||
                            request.status === "cooldown_active"
                              ? "warning"
                              : request.status === "ready_for_release" ||
                                  request.status === "executing"
                                ? "technical"
                                : "positive"
                          }
                        />
                      </div>
                      <div className="mt-4 grid gap-2 text-sm text-slate-600">
                        <p>
                          {locale === "ar" ? "طُلب في" : "Requested"}{" "}
                          <span className="font-semibold text-slate-950">
                            {formatDateLabel(request.requestedAt, locale)}
                          </span>
                        </p>
                        {request.cooldownEndsAt ? (
                          <p>
                            {locale === "ar" ? "تنتهي التهدئة" : "Cooldown ends"}{" "}
                            <span className="font-semibold text-slate-950">
                              {formatDateLabel(request.cooldownEndsAt, locale)}
                            </span>
                          </p>
                        ) : null}
                        {request.reasonCode ? (
                          <p>
                            {locale === "ar" ? "السبب" : "Reason"}{" "}
                            <span className="font-semibold text-slate-950">
                              {request.reasonCode.replaceAll("_", " ")}
                            </span>
                          </p>
                        ) : null}
                      </div>
                      {canCancelReleaseStatus(request.status) ? (
                        <LoadingButton
                          className="mt-4 w-full rounded-[1rem]"
                          isLoading={cancelRetirementVaultRelease.isPending}
                          type="button"
                          onClick={() => {
                            void handleCancelRelease(request.id);
                          }}
                        >
                          {locale === "ar" ? "إلغاء الطلب" : "Cancel request"}
                        </LoadingButton>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <div className="rounded-[1.4rem] border border-dashed border-slate-200 p-5 text-sm text-slate-600">
                    {locale === "ar"
                      ? "لا يوجد طلب إفراج نشط الآن."
                      : "No active governed release request is open right now."}
                  </div>
                )}
              </div>
            </Card>
          </MotionSurface>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <MotionSurface className="stb-pressable-shell">
            <Card className="stb-surface stb-reveal rounded-[2rem] border-0 p-6" data-delay="6">
              <form className="space-y-5" onSubmit={handleRequestRuleChange}>
                <div>
                  <p className="stb-section-kicker">
                    {locale === "ar" ? "حوكمة القواعد" : "Rule governance"}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                    {locale === "ar"
                      ? "تعديل القاعدة عبر مسار محكوم"
                      : "Change the lock rule through a governed path"}
                  </h2>
                </div>

                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-slate-700">
                    {locale === "ar" ? "القبو" : "Vault asset"}
                  </span>
                  <select
                    className="stb-premium-input"
                    value={selectedRuleChangeAssetSymbol}
                    onChange={(event) => setRuleChangeAssetSymbol(event.target.value)}
                  >
                    {vaults.length > 0 ? (
                      vaults.map((vault) => (
                        <option key={vault.id} value={vault.asset.symbol}>
                          {vault.asset.symbol} · {formatDateLabel(vault.unlockAt, locale)}
                        </option>
                      ))
                    ) : (
                      <option value="">
                        {locale === "ar" ? "أنشئ قبو أولاً" : "Create a vault first"}
                      </option>
                    )}
                  </select>
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-slate-700">
                    {locale === "ar" ? "تاريخ الإفراج الجديد" : "New release date"}
                  </span>
                  <Input
                    min={new Date().toISOString().slice(0, 10)}
                    type="date"
                    value={ruleChangeUnlockDate}
                    onChange={(event) => setRuleChangeUnlockDate(event.target.value)}
                  />
                </label>

                <div className="space-y-2">
                  <span className="text-sm font-semibold text-slate-700">
                    {locale === "ar" ? "وضع الحماية الجديد" : "New protection mode"}
                  </span>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      className={`rounded-[1.2rem] border px-4 py-4 text-left transition-colors ${
                        ruleChangeStrictMode
                          ? "border-slate-950 bg-slate-950 text-white"
                          : "border-slate-200 bg-white text-slate-800"
                      }`}
                      onClick={() => setRuleChangeStrictMode(true)}
                    >
                      <p className="text-sm font-semibold">
                        {locale === "ar" ? "صارم" : "Strict"}
                      </p>
                    </button>
                    <button
                      type="button"
                      className={`rounded-[1.2rem] border px-4 py-4 text-left transition-colors ${
                        !ruleChangeStrictMode
                          ? "border-slate-950 bg-slate-950 text-white"
                          : "border-slate-200 bg-white text-slate-800"
                      }`}
                      onClick={() => setRuleChangeStrictMode(false)}
                    >
                      <p className="text-sm font-semibold">
                        {locale === "ar" ? "قياسي" : "Standard"}
                      </p>
                    </button>
                  </div>
                </div>

                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-slate-700">
                    {locale === "ar" ? "سبب الإضعاف" : "Weakening reason"}
                  </span>
                  <select
                    className="stb-premium-input"
                    value={ruleChangeReasonCode}
                    onChange={(event) => setRuleChangeReasonCode(event.target.value)}
                  >
                    <option value="future_lock_reset">
                      {locale === "ar" ? "إعادة ضبط الخطة" : "Future lock reset"}
                    </option>
                    <option value="household_replan">
                      {locale === "ar" ? "إعادة تخطيط أسري" : "Household replan"}
                    </option>
                    <option value="protection_rebalance">
                      {locale === "ar" ? "إعادة موازنة الحماية" : "Protection rebalance"}
                    </option>
                  </select>
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-slate-700">
                    {locale === "ar" ? "مذكرة الحوكمة" : "Governance note"}
                  </span>
                  <Input
                    value={ruleChangeReasonNote}
                    onChange={(event) => setRuleChangeReasonNote(event.target.value)}
                  />
                </label>

                <div className="stb-trust-note text-sm text-amber-900" data-tone="warning">
                  {locale === "ar"
                    ? "أي تعديل يضعف الحماية أو يقرب تاريخ الإفراج لا يُطبق فوراً. يدخل مراجعة مشغّل ثم تهدئة محكومة."
                    : "Any change that weakens protection or pulls the date forward does not apply instantly. It enters operator review and governed cooldown."}
                </div>

                {ruleChangeError ? (
                  <div className="stb-trust-note text-sm text-red-700" data-tone="critical">
                    {ruleChangeError}
                  </div>
                ) : null}

                <LoadingButton
                  className="w-full rounded-[1rem]"
                  disabled={vaults.length === 0}
                  isLoading={requestRetirementVaultRuleChange.isPending}
                  type="submit"
                >
                  {locale === "ar" ? "طلب تعديل القاعدة" : "Request rule change"}
                </LoadingButton>
              </form>
            </Card>
          </MotionSurface>

          <MotionSurface className="stb-pressable-shell">
            <Card className="stb-surface stb-reveal rounded-[2rem] border-0 p-6" data-delay="7">
              <div className="space-y-4">
                <div>
                  <p className="stb-section-kicker">
                    {locale === "ar" ? "تعديلات نشطة" : "Active rule changes"}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                    {locale === "ar"
                      ? "المراجعة والتهدئة ثم التطبيق"
                      : "Review, cooldown, then apply"}
                  </h2>
                </div>

                {activeRuleChangeRequests.length > 0 ? (
                  activeRuleChangeRequests.map((request) => (
                    <div
                      key={request.id}
                      className="rounded-[1.4rem] border border-slate-200 bg-white/80 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-950">
                            {request.asset.displayName}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            {formatDateLabel(request.currentUnlockAt, locale)} to{" "}
                            {formatDateLabel(request.requestedUnlockAt, locale)}
                          </p>
                        </div>
                        <StatusBadge
                          label={request.status.replaceAll("_", " ")}
                          tone={
                            request.status === "review_required" ||
                            request.status === "cooldown_active"
                              ? "warning"
                              : request.status === "ready_to_apply" ||
                                  request.status === "applying"
                                ? "technical"
                                : "positive"
                          }
                        />
                      </div>
                      <div className="mt-4 grid gap-2 text-sm text-slate-600">
                        <p>
                          {locale === "ar" ? "الوضع" : "Mode"}{" "}
                          <span className="font-semibold text-slate-950">
                            {request.currentStrictMode ? "Strict" : "Standard"} to{" "}
                            {request.requestedStrictMode ? "Strict" : "Standard"}
                          </span>
                        </p>
                        {request.cooldownEndsAt ? (
                          <p>
                            {locale === "ar" ? "تنتهي التهدئة" : "Cooldown ends"}{" "}
                            <span className="font-semibold text-slate-950">
                              {formatDateLabel(request.cooldownEndsAt, locale)}
                            </span>
                          </p>
                        ) : null}
                      </div>
                      {canCancelRuleChangeStatus(request.status) ? (
                        <LoadingButton
                          className="mt-4 w-full rounded-[1rem]"
                          isLoading={cancelRetirementVaultRuleChange.isPending}
                          type="button"
                          onClick={() => {
                            void handleCancelRuleChange(request.id);
                          }}
                        >
                          {locale === "ar" ? "إلغاء التعديل" : "Cancel rule change"}
                        </LoadingButton>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <div className="rounded-[1.4rem] border border-dashed border-slate-200 p-5 text-sm text-slate-600">
                    {locale === "ar"
                      ? "لا يوجد تعديل قواعد نشط الآن."
                      : "No governed rule change is active right now."}
                  </div>
                )}
              </div>
            </Card>
          </MotionSurface>
        </section>

        <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {retirementVaultsQuery.isError ? (
            <Card className="stb-trust-note rounded-[1.6rem] border-0 p-5 text-sm text-red-700" data-tone="critical">
              {retirementVaultsQuery.error instanceof Error
                ? retirementVaultsQuery.error.message
                : locale === "ar"
                  ? "تعذر تحميل بيانات القبو."
                  : "Failed to load vault data."}
            </Card>
          ) : vaults.length > 0 ? (
            vaults.map((vault) => (
              <Card key={vault.id} className="stb-surface stb-reveal rounded-[1.7rem] border-0 p-5" data-delay="4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {vault.asset.displayName}
                    </p>
                    <p className="mt-2 text-3xl font-semibold text-slate-950">
                      {formatTokenAmount(vault.lockedBalance, locale)}{" "}
                      <span className="text-base text-slate-500">{vault.asset.symbol}</span>
                    </p>
                  </div>
                  <StatusBadge
                    label={
                      vault.strictMode
                        ? locale === "ar"
                          ? "صارم"
                          : "Strict"
                        : locale === "ar"
                          ? "نشط"
                          : "Active"
                    }
                    tone={vault.strictMode ? "technical" : "positive"}
                  />
                </div>
                <div className="mt-5 grid gap-3 rounded-[1.25rem] border border-slate-200/70 bg-white/75 p-4 text-sm text-slate-600">
                  <div className="flex items-center justify-between gap-3">
                    <span>{locale === "ar" ? "الإفراج المحكوم" : "Governed release"}</span>
                    <span className="font-semibold text-slate-950">
                      {formatDateLabel(vault.unlockAt, locale)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>{locale === "ar" ? "آخر تمويل" : "Last funded"}</span>
                    <span className="font-semibold text-slate-950">
                      {vault.lastFundedAt
                        ? formatDateLabel(vault.lastFundedAt, locale)
                        : locale === "ar"
                          ? "لم يُمول بعد"
                          : "Not funded yet"}
                    </span>
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <Card className="stb-surface rounded-[1.7rem] border-0 p-6 text-sm text-slate-600">
              <div className="flex items-center gap-2 text-slate-950">
                <Landmark className="h-4 w-4" />
                <p className="font-semibold">
                  {locale === "ar"
                    ? "لم يتم إنشاء أي قبو تقاعد بعد"
                    : "No Retirement Vault has been created yet"}
                </p>
              </div>
              <p className="mt-3 leading-7">
                {locale === "ar"
                  ? "ابدأ بأصل واحد تريد عزله عن السحب اليومي، ثم انقل المال من الرصيد المتاح إلى الرصيد المقفل."
                  : "Start with one asset you want isolated from daily withdrawals, then move money from available balance into locked balance."}
              </p>
            </Card>
          )}
        </section>
      </ScreenTransition>
    </Layout>
  );
};

export default RetirementVault;
