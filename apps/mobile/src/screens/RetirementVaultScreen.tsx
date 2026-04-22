import { View } from "react-native";
import { useEffect, useMemo, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { AppScreen } from "../components/ui/AppScreen";
import { AppButton } from "../components/ui/AppButton";
import { AppText } from "../components/ui/AppText";
import { AnimatedSection } from "../components/ui/AnimatedSection";
import { FieldInput } from "../components/ui/FieldInput";
import { InlineNotice } from "../components/ui/InlineNotice";
import { ScreenHeaderActions } from "../components/ui/ScreenHeaderActions";
import { OptionChips } from "../components/ui/OptionChips";
import { SectionCard } from "../components/ui/SectionCard";
import {
  useBalancesQuery,
  useCancelRetirementVaultReleaseMutation,
  useCancelRetirementVaultRuleChangeMutation,
  useCreateRetirementVaultMutation,
  useFundRetirementVaultMutation,
  useRequestRetirementVaultReleaseMutation,
  useRequestRetirementVaultRuleChangeMutation,
  useRetirementVaultsQuery,
  useSupportedAssetsQuery,
} from "../hooks/use-customer-queries";
import { useScreenFeedback } from "../hooks/use-app-feedback";
import { useLocale } from "../i18n/use-locale";
import {
  buildRequestIdempotencyKey,
  compareDecimalStrings,
  formatDateLabel,
  formatTokenAmount,
  isPositiveDecimalString,
  isPositiveIntegerString,
} from "../lib/finance";
import type {
  RetirementVaultReleaseRequestProjection,
  RetirementVaultRuleChangeRequestProjection,
} from "../lib/api/types";
import { useSessionStore } from "../stores/session-store";

type RetirementVaultScreenProps = {
  initialFocus?: "create" | "fund" | "release" | "rules";
};

function isActiveReleaseStatus(status: RetirementVaultReleaseRequestProjection["status"]) {
  return [
    "requested",
    "review_required",
    "approved",
    "cooldown_active",
    "ready_for_release",
    "executing",
  ].includes(status);
}

function canCancelReleaseStatus(
  status: RetirementVaultReleaseRequestProjection["status"],
) {
  return ["requested", "review_required", "approved", "cooldown_active"].includes(
    status,
  );
}

function isActiveRuleChangeStatus(
  status: RetirementVaultRuleChangeRequestProjection["status"],
) {
  return [
    "review_required",
    "cooldown_active",
    "ready_to_apply",
    "applying",
  ].includes(status);
}

function canCancelRuleChangeStatus(
  status: RetirementVaultRuleChangeRequestProjection["status"],
) {
  return ["review_required", "cooldown_active"].includes(status);
}

function isBlockedVaultStatus(status: string) {
  return status === "restricted" || status === "incident_locked";
}

function getVaultStatusLabel(status: string, locale: string) {
  switch (status) {
    case "incident_locked":
      return locale === "ar" ? "مغلق بسبب حادث" : "Incident locked";
    case "restricted":
      return locale === "ar" ? "مقيد" : "Restricted";
    case "released":
      return locale === "ar" ? "مفرج عنه" : "Released";
    default:
      return locale === "ar" ? "نشط" : "Active";
  }
}

export function RetirementVaultScreen({
  initialFocus = "fund",
}: RetirementVaultScreenProps) {
  const { locale } = useLocale();
  const feedback = useScreenFeedback();
  const navigation = useNavigation<any>();
  const rememberRequestKey = useSessionStore(
    (state) => state.rememberRequestKey,
  );
  const consumeRequestKey = useSessionStore((state) => state.consumeRequestKey);
  const clearRequestKey = useSessionStore((state) => state.clearRequestKey);
  const assetsQuery = useSupportedAssetsQuery();
  const balancesQuery = useBalancesQuery();
  const retirementVaultsQuery = useRetirementVaultsQuery();
  const createRetirementVaultMutation = useCreateRetirementVaultMutation();
  const fundRetirementVaultMutation = useFundRetirementVaultMutation();
  const requestRetirementVaultReleaseMutation =
    useRequestRetirementVaultReleaseMutation();
  const cancelRetirementVaultReleaseMutation =
    useCancelRetirementVaultReleaseMutation();
  const requestRetirementVaultRuleChangeMutation =
    useRequestRetirementVaultRuleChangeMutation();
  const cancelRetirementVaultRuleChangeMutation =
    useCancelRetirementVaultRuleChangeMutation();
  const assets = assetsQuery.data?.assets ?? [];
  const balances = balancesQuery.data?.balances ?? [];
  const vaults = retirementVaultsQuery.data?.vaults ?? [];
  const [focus, setFocus] = useState<"create" | "fund" | "release" | "rules">(
    initialFocus,
  );
  const [createAsset, setCreateAsset] = useState("");
  const [fundAsset, setFundAsset] = useState("");
  const [releaseAsset, setReleaseAsset] = useState("");
  const [unlockYears, setUnlockYears] = useState("10");
  const [strictMode, setStrictMode] = useState("strict");
  const [fundAmount, setFundAmount] = useState("");
  const [releaseAmount, setReleaseAmount] = useState("");
  const [ruleChangeAsset, setRuleChangeAsset] = useState("");
  const [ruleChangeUnlockYears, setRuleChangeUnlockYears] = useState("10");
  const [ruleChangeStrictMode, setRuleChangeStrictMode] = useState("strict");
  const [ruleChangeReasonCode, setRuleChangeReasonCode] =
    useState("future_lock_reset");
  const [ruleChangeReasonNote, setRuleChangeReasonNote] = useState("");
  const [releaseReasonCode, setReleaseReasonCode] = useState("hardship");
  const [releaseReasonNote, setReleaseReasonNote] = useState("");
  const [releaseEvidenceNote, setReleaseEvidenceNote] = useState("");
  const retirementVaultTitle =
    locale === "ar" ? "قبو التقاعد" : "Retirement Vault";

  function showSuccess(message: string) {
    feedback.success(message, { title: retirementVaultTitle });
  }

  function showWarning(message: string) {
    feedback.warning(message, { title: retirementVaultTitle });
  }

  function showError(error: unknown) {
    feedback.errorFrom(error, undefined, { title: retirementVaultTitle });
  }

  useEffect(() => {
    setFocus(initialFocus);
  }, [initialFocus]);

  const activeCreateAsset = createAsset || assets[0]?.symbol || "";
  const activeFundAsset = fundAsset || vaults[0]?.asset.symbol || "";
  const activeReleaseAsset = releaseAsset || vaults[0]?.asset.symbol || "";
  const activeRuleChangeAsset = ruleChangeAsset || vaults[0]?.asset.symbol || "";
  const selectedFundBalance =
    balances.find((balance) => balance.asset.symbol === activeFundAsset) ?? null;
  const selectedReleaseVault =
    vaults.find((vault) => vault.asset.symbol === activeReleaseAsset) ?? null;
  const selectedRuleChangeVault =
    vaults.find((vault) => vault.asset.symbol === activeRuleChangeAsset) ?? null;
  const lockedVaultBalance = vaults.reduce(
    (sum, vault) => sum + Number.parseFloat(vault.lockedBalance || "0"),
    0,
  );
  const nextVaultUnlock = vaults
    .map((vault) => vault.unlockAt)
    .sort((left, right) => Date.parse(left) - Date.parse(right))[0];
  const activeReleaseRequests = useMemo(
    () =>
      vaults
        .flatMap((vault) =>
          vault.releaseRequests.map((request) => ({
            ...request,
            asset: vault.asset,
          })),
        )
        .filter((request) => isActiveReleaseStatus(request.status))
        .sort(
          (left, right) =>
            Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
        ),
    [vaults],
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

  function getIdempotencyKey(signature: string): string {
    const existing = consumeRequestKey(signature);

    if (existing) {
      return existing;
    }

    const nextKey = buildRequestIdempotencyKey("vault_fund_req");
    rememberRequestKey(signature, nextKey);
    return nextKey;
  }

  async function handleCreateVault() {
    if (!activeCreateAsset) {
      showWarning(
        locale === "ar"
          ? "اختر أصلاً قبل إنشاء القبو."
          : "Select an asset before creating the vault."
      );
      return;
    }

    if (!isPositiveIntegerString(unlockYears)) {
      showWarning(
        locale === "ar"
          ? "أدخل عدداً صحيحاً من السنوات."
          : "Enter a whole number of years."
      );
      return;
    }

    const unlockAt = new Date();
    unlockAt.setUTCFullYear(
      unlockAt.getUTCFullYear() + Number.parseInt(unlockYears, 10),
    );

    try {
      const result = await createRetirementVaultMutation.mutateAsync({
        assetSymbol: activeCreateAsset,
        unlockAt: unlockAt.toISOString(),
        strictMode: strictMode === "strict",
      });
      setFundAsset(result.vault.asset.symbol);
      setReleaseAsset(result.vault.asset.symbol);
      setFocus("fund");
      showSuccess(
        result.created
          ? locale === "ar"
            ? "تم إنشاء القبو. يمكنك تمويله الآن."
            : "The vault was created. You can fund it now."
          : locale === "ar"
            ? "القبو موجود بالفعل لهذا الأصل."
            : "A vault already exists for this asset."
      );
    } catch (requestError) {
      showError(requestError);
    }
  }

  async function handleFundVault() {
    if (!activeFundAsset) {
      showWarning(
        locale === "ar"
          ? "أنشئ قبو تقاعد أولاً."
          : "Create a retirement vault first."
      );
      return;
    }

    if (!isPositiveDecimalString(fundAmount)) {
      showWarning(
        locale === "ar"
          ? "أدخل مبلغاً موجباً صالحاً."
          : "Enter a valid positive amount."
      );
      return;
    }

    if (
      selectedFundBalance &&
      compareDecimalStrings(
        fundAmount.trim(),
        selectedFundBalance.availableBalance,
      ) === 1
    ) {
      showWarning(
        locale === "ar"
          ? "المبلغ يتجاوز الرصيد المتاح."
          : "Amount exceeds the available balance."
      );
      return;
    }

    const signature = JSON.stringify({
      assetSymbol: activeFundAsset,
      amount: fundAmount.trim(),
    });

    try {
      await fundRetirementVaultMutation.mutateAsync({
        idempotencyKey: getIdempotencyKey(signature),
        assetSymbol: activeFundAsset,
        amount: fundAmount.trim(),
      });
      clearRequestKey(signature);
      setFundAmount("");
      showSuccess(
        locale === "ar"
          ? "تم نقل الأموال إلى الرصيد المقفل."
          : "Funds were moved into the locked vault balance."
      );
    } catch (requestError) {
      showError(requestError);
    }
  }

  async function handleRequestRelease() {
    if (!selectedReleaseVault) {
      showWarning(
        locale === "ar"
          ? "أنشئ أو اختر قبو تقاعد أولاً."
          : "Create or select a retirement vault first."
      );
      return;
    }

    if (!isPositiveDecimalString(releaseAmount)) {
      showWarning(
        locale === "ar" ? "أدخل مبلغ إفراج صالحاً." : "Enter a valid release amount."
      );
      return;
    }

    if (
      compareDecimalStrings(releaseAmount.trim(), selectedReleaseVault.lockedBalance) ===
      1
    ) {
      showWarning(
        locale === "ar"
          ? "المبلغ يتجاوز الرصيد المقفل داخل القبو."
          : "Amount exceeds the locked balance in the vault."
      );
      return;
    }

    try {
      const result = await requestRetirementVaultReleaseMutation.mutateAsync({
        assetSymbol: selectedReleaseVault.asset.symbol,
        amount: releaseAmount.trim(),
        reasonCode:
          new Date(selectedReleaseVault.unlockAt) > new Date()
            ? releaseReasonCode
            : undefined,
        reasonNote: releaseReasonNote.trim() || undefined,
        evidenceNote: releaseEvidenceNote.trim() || undefined,
      });
      setReleaseAmount("");
      setReleaseReasonNote("");
      setReleaseEvidenceNote("");
      showSuccess(
        result.releaseRequest.status === "review_required"
          ? locale === "ar"
            ? "تم تسجيل الإفراج المبكر ودخل الآن مسار مراجعة إلزامي."
            : "Early unlock was recorded and has entered mandatory review."
          : locale === "ar"
            ? "تم فتح نافذة التهدئة قبل إعادة المال إلى الرصيد السائل."
            : "A cooldown window is now open before funds return to liquid balance."
      );
    } catch (requestError) {
      showError(requestError);
    }
  }

  async function handleCancelRelease(releaseRequestId: string) {
    try {
      await cancelRetirementVaultReleaseMutation.mutateAsync(releaseRequestId);
      showSuccess(
        locale === "ar"
          ? "تم إلغاء طلب الإفراج."
          : "The unlock request was cancelled."
      );
    } catch (requestError) {
      showError(requestError);
    }
  }

  async function handleRequestRuleChange() {
    if (!selectedRuleChangeVault) {
      showWarning(
        locale === "ar"
          ? "أنشئ أو اختر قبو تقاعد أولاً."
          : "Create or select a retirement vault first."
      );
      return;
    }

    if (!isPositiveIntegerString(ruleChangeUnlockYears)) {
      showWarning(
        locale === "ar"
          ? "أدخل عدداً صحيحاً من السنوات."
          : "Enter a whole number of years."
      );
      return;
    }

    const unlockAt = new Date();
    unlockAt.setUTCFullYear(
      unlockAt.getUTCFullYear() + Number.parseInt(ruleChangeUnlockYears, 10),
    );

    const weakensProtection =
      unlockAt.getTime() < new Date(selectedRuleChangeVault.unlockAt).getTime() ||
      (selectedRuleChangeVault.strictMode && ruleChangeStrictMode !== "strict");

    try {
      const result = await requestRetirementVaultRuleChangeMutation.mutateAsync({
        assetSymbol: selectedRuleChangeVault.asset.symbol,
        unlockAt: unlockAt.toISOString(),
        strictMode: ruleChangeStrictMode === "strict",
        reasonCode: weakensProtection ? ruleChangeReasonCode : undefined,
        reasonNote: ruleChangeReasonNote.trim() || undefined,
      });

      showSuccess(
        result.appliedImmediately
          ? locale === "ar"
            ? "تم تطبيق تشديد القاعدة فوراً."
            : "The rule strengthening was applied immediately."
          : locale === "ar"
            ? "دخل تعديل القاعدة مسار مراجعة وتهدئة محكوم."
            : "The rule change entered governed review and cooldown."
      );
    } catch (requestError) {
      showError(requestError);
    }
  }

  async function handleCancelRuleChange(ruleChangeRequestId: string) {
    try {
      await cancelRetirementVaultRuleChangeMutation.mutateAsync(ruleChangeRequestId);
      showSuccess(
        locale === "ar"
          ? "تم إلغاء تعديل القاعدة."
          : "The rule change was cancelled."
      );
    } catch (requestError) {
      showError(requestError);
    }
  }

  const assetOptions = useMemo(
    () =>
      assets.map((asset) => ({
        label: asset.symbol,
        value: asset.symbol,
      })),
    [assets],
  );
  const vaultOptions = useMemo(
    () =>
      vaults.map((vault) => ({
        label: vault.asset.symbol,
        value: vault.asset.symbol,
      })),
    [vaults],
  );

  return (
    <AppScreen
      title={locale === "ar" ? "قبو التقاعد" : "Retirement Vault"}
      subtitle={
        locale === "ar"
          ? "أنشئ القفل، موّل الرصيد المقفل، ثم افتح الإفراج أو تعديل القاعدة عبر مسار محكوم."
          : "Create the lock, fund the protected balance, then open governed release or rule change when needed."
      }
      trailing={<ScreenHeaderActions />}
    >
      <AnimatedSection delayOrder={1} variant="up">
        <View className="overflow-hidden rounded-[36px] bg-ink px-5 py-6">
          <View className="absolute -right-10 -top-6 h-32 w-32 rounded-full bg-white/10" />
          <View className="gap-4">
            <View className="gap-2">
              <AppText
                className="text-sm uppercase tracking-[1.3px] text-sea"
                weight="semibold"
              >
                {locale === "ar" ? "أموال محمية" : "Protected funds"}
              </AppText>
              <AppText className="text-3xl text-white" weight="bold">
                {retirementVaultsQuery.isLoading
                  ? "..."
                  : formatTokenAmount(String(lockedVaultBalance), locale)}
              </AppText>
              <AppText className="text-sm leading-6 text-sand">
                {nextVaultUnlock
                  ? locale === "ar"
                    ? `أقرب إفراج محكوم ${formatDateLabel(nextVaultUnlock, locale)}.`
                    : `Next governed release ${formatDateLabel(nextVaultUnlock, locale)}.`
                  : locale === "ar"
                    ? "لا يوجد إفراج محكوم مجدول بعد."
                    : "No governed release is scheduled yet."}
              </AppText>
            </View>
            <View className="flex-row flex-wrap gap-3">
              <View className="min-w-[46%] flex-1 rounded-[24px] bg-white/8 px-4 py-4">
                <AppText className="text-xs uppercase tracking-[1.2px] text-sea">
                  {locale === "ar" ? "عدد الأقبية" : "Vault count"}
                </AppText>
                <AppText className="mt-2 text-3xl text-white" weight="bold">
                  {vaults.length}
                </AppText>
              </View>
              <View className="min-w-[46%] flex-1 rounded-[24px] bg-white/8 px-4 py-4">
                <AppText className="text-xs uppercase tracking-[1.2px] text-sea">
                  {locale === "ar" ? "طلبات نشطة" : "Active requests"}
                </AppText>
                <AppText className="mt-2 text-3xl text-white" weight="bold">
                  {activeReleaseRequests.length + activeRuleChangeRequests.length}
                </AppText>
              </View>
              <View className="min-w-[46%] flex-1 rounded-[24px] bg-white/8 px-4 py-4">
                <AppText className="text-xs uppercase tracking-[1.2px] text-sea">
                  {locale === "ar" ? "وضع الحماية" : "Protection mode"}
                </AppText>
                <AppText className="mt-2 text-sm text-white" weight="semibold">
                  {locale === "ar"
                    ? "خارج السحب العادي"
                    : "Outside normal withdrawals"}
                </AppText>
              </View>
            </View>
          </View>
        </View>
      </AnimatedSection>

      <AnimatedSection delayOrder={2}>
        <SectionCard className="gap-4">
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-1 gap-1">
              <AppText className="text-xl text-ink" weight="bold">
                {locale === "ar" ? "المسار" : "Flow"}
              </AppText>
              <AppText className="text-sm leading-6 text-slate">
                {locale === "ar"
                  ? "أنشئ القبو، موّله، ثم استخدم الإفراج المحكوم بدلاً من السحب العادي."
                  : "Create the vault, fund it, then use governed release instead of ordinary withdrawals."}
              </AppText>
            </View>
            <View className="h-11 w-11 items-center justify-center rounded-2xl bg-ink/6">
              <MaterialCommunityIcons
                color="#14212b"
                name="shield-lock-outline"
                size={22}
              />
            </View>
          </View>
          <OptionChips
            onChange={(value) =>
              setFocus(value as "create" | "fund" | "release" | "rules")
            }
            options={[
              {
                label: locale === "ar" ? "إنشاء" : "Create",
                value: "create",
              },
              {
                label: locale === "ar" ? "تمويل" : "Fund",
                value: "fund",
              },
              {
                label: locale === "ar" ? "إفراج" : "Release",
                value: "release",
              },
              {
                label: locale === "ar" ? "قواعد" : "Rules",
                value: "rules",
              },
            ]}
            value={focus}
          />
        </SectionCard>
      </AnimatedSection>

      <AnimatedSection delayOrder={3}>
        <SectionCard className="gap-4">
          {focus === "create" ? (
            <>
              <AppText className="text-xl text-ink" weight="bold">
                {locale === "ar" ? "إنشاء القبو" : "Create vault"}
              </AppText>
              <OptionChips
                onChange={setCreateAsset}
                options={assetOptions}
                value={activeCreateAsset}
              />
              <FieldInput
                keyboardType="number-pad"
                label={locale === "ar" ? "سنوات القفل" : "Lock years"}
                onChangeText={setUnlockYears}
                value={unlockYears}
              />
              <OptionChips
                onChange={setStrictMode}
                options={[
                  {
                    label: locale === "ar" ? "صارم" : "Strict",
                    value: "strict",
                  },
                  {
                    label: locale === "ar" ? "قياسي" : "Standard",
                    value: "standard",
                  },
                ]}
                value={strictMode}
              />
              <InlineNotice
                message={
                  locale === "ar"
                    ? "الوضع الصارم يجعل لغة الحماية أوضح ويثبّت القفل كنقطة قرار مقصودة."
                    : "Strict mode makes the protection language heavier and frames the lock as a deliberate decision."
                }
                tone="warning"
              />
              <AppButton
                disabled={createRetirementVaultMutation.isPending}
                label={
                  createRetirementVaultMutation.isPending
                    ? locale === "ar"
                      ? "جارٍ إنشاء القبو..."
                      : "Creating vault..."
                    : locale === "ar"
                      ? "إنشاء القبو"
                      : "Create vault"
                }
                onPress={() => {
                  void handleCreateVault();
                }}
              />
            </>
          ) : focus === "fund" ? (
            <>
              <AppText className="text-xl text-ink" weight="bold">
                {locale === "ar" ? "تمويل القبو" : "Fund vault"}
              </AppText>
              <OptionChips
                onChange={setFundAsset}
                options={
                  vaultOptions.length > 0
                    ? vaultOptions
                    : [
                        {
                          label: locale === "ar" ? "لا توجد أقبية" : "No vaults",
                          value: "",
                        },
                      ]
                }
                value={activeFundAsset}
              />
              <FieldInput
                keyboardType="decimal-pad"
                label={locale === "ar" ? "المبلغ" : "Amount"}
                onChangeText={setFundAmount}
                value={fundAmount}
              />
              <InlineNotice
                message={
                  selectedFundBalance
                    ? locale === "ar"
                      ? `الرصيد المتاح: ${formatTokenAmount(selectedFundBalance.availableBalance, locale)} ${selectedFundBalance.asset.symbol}`
                      : `Available balance: ${formatTokenAmount(selectedFundBalance.availableBalance, locale)} ${selectedFundBalance.asset.symbol}`
                    : locale === "ar"
                      ? "أنشئ القبو أولاً."
                      : "Create the vault first."
                }
                tone="neutral"
              />
              <AppButton
                disabled={fundRetirementVaultMutation.isPending || vaults.length === 0}
                label={
                  fundRetirementVaultMutation.isPending
                    ? locale === "ar"
                      ? "جارٍ تمويل القبو..."
                      : "Funding vault..."
                    : locale === "ar"
                      ? "تمويل القبو"
                      : "Fund vault"
                }
                onPress={() => {
                  void handleFundVault();
                }}
              />
            </>
          ) : focus === "release" ? (
            <>
              <AppText className="text-xl text-ink" weight="bold">
                {locale === "ar" ? "طلب الإفراج" : "Request release"}
              </AppText>
              <OptionChips
                onChange={setReleaseAsset}
                options={
                  vaultOptions.length > 0
                    ? vaultOptions
                    : [
                        {
                          label: locale === "ar" ? "لا توجد أقبية" : "No vaults",
                          value: "",
                        },
                      ]
                }
                value={activeReleaseAsset}
              />
              <FieldInput
                keyboardType="decimal-pad"
                label={locale === "ar" ? "مبلغ الإفراج" : "Release amount"}
                onChangeText={setReleaseAmount}
                value={releaseAmount}
              />
              <OptionChips
                onChange={setReleaseReasonCode}
                options={[
                  {
                    label: locale === "ar" ? "ضائقة" : "Hardship",
                    value: "hardship",
                  },
                  {
                    label: locale === "ar" ? "طوارئ" : "Emergency",
                    value: "emergency",
                  },
                  {
                    label: locale === "ar" ? "التزام عائلي" : "Family",
                    value: "family_commitment",
                  },
                ]}
                value={releaseReasonCode}
              />
              <FieldInput
                label={locale === "ar" ? "ملاحظة السبب" : "Reason note"}
                onChangeText={setReleaseReasonNote}
                value={releaseReasonNote}
              />
              <FieldInput
                label={
                  locale === "ar" ? "دليل أو شرح إضافي" : "Evidence or extra context"
                }
                onChangeText={setReleaseEvidenceNote}
                value={releaseEvidenceNote}
              />
              <InlineNotice
                message={
                  selectedReleaseVault &&
                  selectedReleaseVault.status === "incident_locked"
                    ? locale === "ar"
                      ? "هذا القبو تحت قفل حادثة. يبقى الإفراج والتهدئة متوقفين حتى يرفع المشغلون حماية الحادثة."
                      : "This vault is incident locked. Release and cooldown remain blocked until operators clear the incident protection."
                    : selectedReleaseVault &&
                        selectedReleaseVault.status === "restricted"
                      ? locale === "ar"
                        ? "هذا القبو مقيد حالياً. لا يمكن بدء إفراج جديد حتى يرفع المشغلون التقييد."
                        : "This vault is currently restricted. A new governed release cannot start until operators release the restriction."
                      : selectedReleaseVault &&
                          new Date(selectedReleaseVault.unlockAt) > new Date()
                    ? locale === "ar"
                      ? "هذا إفراج مبكر. سيدخل مسار مراجعة إلزامي ثم فترة تهدئة قبل التنفيذ."
                      : "This is an early unlock. It enters mandatory review and then a cooldown before execution."
                    : locale === "ar"
                      ? "هذا إفراج طبيعي بعد تحقق تاريخ القفل. سيدخل مباشرة في نافذة تهدئة محكومة."
                      : "This is a normal unlock after the lock date. It moves directly into a governed cooldown window."
                }
                tone={
                  selectedReleaseVault && isBlockedVaultStatus(selectedReleaseVault.status)
                    ? "critical"
                    : "warning"
                }
              />
              <AppButton
                disabled={
                  requestRetirementVaultReleaseMutation.isPending ||
                  vaults.length === 0 ||
                  !selectedReleaseVault ||
                  selectedReleaseVault.status !== "active"
                }
                label={
                  requestRetirementVaultReleaseMutation.isPending
                    ? locale === "ar"
                      ? "جارٍ تسجيل الإفراج..."
                      : "Recording release..."
                    : locale === "ar"
                      ? "طلب الإفراج المحكوم"
                      : "Request governed release"
                }
                onPress={() => {
                  void handleRequestRelease();
                }}
              />
            </>
          ) : (
            <>
              <AppText className="text-xl text-ink" weight="bold">
                {locale === "ar" ? "تعديل القاعدة" : "Rule change"}
              </AppText>
              <OptionChips
                onChange={setRuleChangeAsset}
                options={
                  vaultOptions.length > 0
                    ? vaultOptions
                    : [
                        {
                          label: locale === "ar" ? "لا توجد أقبية" : "No vaults",
                          value: "",
                        },
                      ]
                }
                value={activeRuleChangeAsset}
              />
              <FieldInput
                keyboardType="number-pad"
                label={locale === "ar" ? "سنوات الإفراج الجديدة" : "New release years"}
                onChangeText={setRuleChangeUnlockYears}
                value={ruleChangeUnlockYears}
              />
              <OptionChips
                onChange={setRuleChangeStrictMode}
                options={[
                  {
                    label: locale === "ar" ? "صارم" : "Strict",
                    value: "strict",
                  },
                  {
                    label: locale === "ar" ? "قياسي" : "Standard",
                    value: "standard",
                  },
                ]}
                value={ruleChangeStrictMode}
              />
              <OptionChips
                onChange={setRuleChangeReasonCode}
                options={[
                  {
                    label: locale === "ar" ? "إعادة ضبط" : "Reset",
                    value: "future_lock_reset",
                  },
                  {
                    label: locale === "ar" ? "إعادة تخطيط" : "Replan",
                    value: "household_replan",
                  },
                  {
                    label: locale === "ar" ? "موازنة" : "Rebalance",
                    value: "protection_rebalance",
                  },
                ]}
                value={ruleChangeReasonCode}
              />
              <FieldInput
                label={locale === "ar" ? "ملاحظة الحوكمة" : "Governance note"}
                onChangeText={setRuleChangeReasonNote}
                value={ruleChangeReasonNote}
              />
              <InlineNotice
                message={
                  selectedRuleChangeVault &&
                  selectedRuleChangeVault.status === "incident_locked"
                    ? locale === "ar"
                      ? "هذا القبو تحت قفل حادثة. تبقى تعديلات القواعد متوقفة حتى يرفع المشغلون حماية الحادثة."
                      : "This vault is incident locked. Rule changes remain blocked until operators clear the incident protection."
                    : selectedRuleChangeVault &&
                        selectedRuleChangeVault.status === "restricted"
                      ? locale === "ar"
                        ? "هذا القبو مقيد حالياً. تبقى تعديلات القواعد متوقفة حتى يرفع المشغلون التقييد."
                        : "This vault is currently restricted. Rule changes remain blocked until operators release the restriction."
                      : locale === "ar"
                        ? "تعديل القاعدة الذي يضعف الحماية لا يُطبق فوراً. يدخل مراجعة ثم تهدئة قبل التطبيق."
                        : "A rule change that weakens protection does not apply immediately. It enters review and cooldown before application."
                }
                tone={
                  selectedRuleChangeVault &&
                  isBlockedVaultStatus(selectedRuleChangeVault.status)
                    ? "critical"
                    : "warning"
                }
              />
              <AppButton
                disabled={
                  requestRetirementVaultRuleChangeMutation.isPending ||
                  vaults.length === 0 ||
                  !selectedRuleChangeVault ||
                  selectedRuleChangeVault.status !== "active"
                }
                label={
                  requestRetirementVaultRuleChangeMutation.isPending
                    ? locale === "ar"
                      ? "جارٍ تسجيل التعديل..."
                      : "Recording rule change..."
                    : locale === "ar"
                      ? "طلب تعديل القاعدة"
                      : "Request rule change"
                }
                onPress={() => {
                  void handleRequestRuleChange();
                }}
              />
            </>
          )}
        </SectionCard>
      </AnimatedSection>

      <AnimatedSection delayOrder={4}>
        <SectionCard className="gap-3">
          <View className="flex-row items-center justify-between gap-3">
            <AppText className="text-xl text-ink" weight="bold">
              {locale === "ar" ? "الطلبات النشطة" : "Active unlock requests"}
            </AppText>
            <View className="rounded-full bg-ink px-3 py-1">
              <AppText className="text-xs text-white" weight="semibold">
                {activeReleaseRequests.length}
              </AppText>
            </View>
          </View>
          {activeReleaseRequests.length === 0 ? (
            <AppText className="text-sm leading-6 text-slate">
              {locale === "ar"
                ? "لا يوجد طلب إفراج نشط الآن."
                : "No active governed release request is open right now."}
            </AppText>
          ) : (
            activeReleaseRequests.map((request) => (
              <View
                key={request.id}
                className="gap-3 rounded-2xl border border-border bg-white px-4 py-4"
              >
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1 gap-1">
                    <AppText className="text-base text-ink" weight="semibold">
                      {request.asset.displayName}
                    </AppText>
                    <AppText className="text-lg text-ink" weight="bold">
                      {formatTokenAmount(request.requestedAmount, locale)}{" "}
                      {request.asset.symbol}
                    </AppText>
                  </View>
                  <View className="rounded-full bg-amber-100 px-3 py-1">
                    <AppText className="text-xs text-amber-950" weight="semibold">
                      {request.status.replaceAll("_", " ")}
                    </AppText>
                  </View>
                </View>
                <AppText className="text-sm text-slate">
                  {locale === "ar" ? "طُلب في:" : "Requested:"}{" "}
                  {formatDateLabel(request.requestedAt, locale)}
                </AppText>
                {request.cooldownEndsAt ? (
                  <AppText className="text-sm text-slate">
                    {locale === "ar" ? "تنتهي التهدئة:" : "Cooldown ends:"}{" "}
                    {formatDateLabel(request.cooldownEndsAt, locale)}
                  </AppText>
                ) : null}
                {request.reasonCode ? (
                  <AppText className="text-sm text-slate">
                    {locale === "ar" ? "السبب:" : "Reason:"}{" "}
                    {request.reasonCode.replaceAll("_", " ")}
                  </AppText>
                ) : null}
                {canCancelReleaseStatus(request.status) ? (
                  <AppButton
                    disabled={cancelRetirementVaultReleaseMutation.isPending}
                    label={
                      cancelRetirementVaultReleaseMutation.isPending
                        ? locale === "ar"
                          ? "جارٍ الإلغاء..."
                          : "Cancelling..."
                        : locale === "ar"
                          ? "إلغاء الطلب"
                          : "Cancel request"
                    }
                    onPress={() => {
                      void handleCancelRelease(request.id);
                    }}
                    variant="ghost"
                  />
                ) : null}
              </View>
            ))
          )}
        </SectionCard>
      </AnimatedSection>

      <AnimatedSection delayOrder={5}>
        <SectionCard className="gap-3">
          <View className="flex-row items-center justify-between gap-3">
            <AppText className="text-xl text-ink" weight="bold">
              {locale === "ar" ? "تعديلات القاعدة النشطة" : "Active rule changes"}
            </AppText>
            <View className="rounded-full bg-ink px-3 py-1">
              <AppText className="text-xs text-white" weight="semibold">
                {activeRuleChangeRequests.length}
              </AppText>
            </View>
          </View>
          {activeRuleChangeRequests.length === 0 ? (
            <AppText className="text-sm leading-6 text-slate">
              {locale === "ar"
                ? "لا يوجد تعديل قاعدة نشط الآن."
                : "No governed rule change is active right now."}
            </AppText>
          ) : (
            activeRuleChangeRequests.map((request) => (
              <View
                key={request.id}
                className="gap-3 rounded-2xl border border-border bg-white px-4 py-4"
              >
                <AppText className="text-base text-ink" weight="semibold">
                  {request.asset.displayName}
                </AppText>
                <AppText className="text-sm text-slate">
                  {formatDateLabel(request.currentUnlockAt, locale)} to{" "}
                  {formatDateLabel(request.requestedUnlockAt, locale)}
                </AppText>
                {canCancelRuleChangeStatus(request.status) ? (
                  <AppButton
                    disabled={cancelRetirementVaultRuleChangeMutation.isPending}
                    label={
                      cancelRetirementVaultRuleChangeMutation.isPending
                        ? locale === "ar"
                          ? "جارٍ الإلغاء..."
                          : "Cancelling..."
                        : locale === "ar"
                          ? "إلغاء التعديل"
                          : "Cancel rule change"
                    }
                    onPress={() => {
                      void handleCancelRuleChange(request.id);
                    }}
                    variant="ghost"
                  />
                ) : null}
              </View>
            ))
          )}
        </SectionCard>
      </AnimatedSection>

      <AnimatedSection delayOrder={6}>
        <SectionCard className="gap-3">
          <View className="flex-row items-center justify-between gap-3">
            <AppText className="text-xl text-ink" weight="bold">
              {locale === "ar" ? "الأقبية الحالية" : "Current vaults"}
            </AppText>
            <AppButton
              fullWidth={false}
              label={locale === "ar" ? "المحفظة" : "Wallet"}
              onPress={() => navigation.navigate("MainTabs")}
              variant="ghost"
            />
          </View>
          {retirementVaultsQuery.isError ? (
            <InlineNotice
              message={
                retirementVaultsQuery.error instanceof Error
                  ? retirementVaultsQuery.error.message
                  : locale === "ar"
                    ? "تعذر تحميل الأقبية."
                    : "Failed to load vaults."
              }
              tone="critical"
            />
          ) : vaults.length === 0 ? (
            <AppText className="text-sm leading-6 text-slate">
              {locale === "ar"
                ? "لا يوجد أي قبو حتى الآن."
                : "No vaults exist yet."}
            </AppText>
          ) : (
            vaults.map((vault) => (
              <View
                key={vault.id}
                className="gap-2 rounded-2xl border border-border bg-white px-4 py-4"
              >
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1 gap-1">
                    <AppText className="text-base text-ink" weight="semibold">
                      {vault.asset.displayName}
                    </AppText>
                    <AppText className="text-lg text-ink" weight="bold">
                      {formatTokenAmount(vault.lockedBalance, locale)}{" "}
                      {vault.asset.symbol}
                    </AppText>
                  </View>
                  <View
                    className={`rounded-full px-3 py-1 ${
                      vault.status === "incident_locked"
                        ? "bg-rose-700"
                        : vault.status === "restricted"
                          ? "bg-amber-700"
                          : vault.status === "released"
                            ? "bg-slate-500"
                            : "bg-ink"
                    }`}
                  >
                    <AppText className="text-xs text-white" weight="semibold">
                      {getVaultStatusLabel(vault.status, locale)}
                    </AppText>
                  </View>
                </View>
                <AppText className="text-sm text-slate">
                  {locale === "ar" ? "وضع الحماية:" : "Protection mode:"}{" "}
                  {vault.strictMode
                    ? locale === "ar"
                      ? "صارم"
                      : "Strict"
                    : locale === "ar"
                      ? "قياسي"
                      : "Standard"}
                </AppText>
                <AppText className="text-sm text-slate">
                  {locale === "ar" ? "الإفراج:" : "Release:"}{" "}
                  {formatDateLabel(vault.unlockAt, locale)}
                </AppText>
                {vault.releaseRequests[0] ? (
                  <AppText className="text-sm text-slate">
                    {locale === "ar" ? "آخر حالة:" : "Latest status:"}{" "}
                    {vault.releaseRequests[0].status.replaceAll("_", " ")}
                  </AppText>
                ) : null}
                {vault.status === "incident_locked" ? (
                  <InlineNotice
                    message={
                      locale === "ar"
                        ? "هذا القبو تحت حماية مرتبطة بحادثة ولن يتابع الإفراج أو تعديل القواعد حتى يرفع المشغلون القفل."
                        : "This vault is under incident-linked protection and will not progress through release or rule changes until operators clear the lock."
                    }
                    tone="critical"
                  />
                ) : vault.status === "restricted" ? (
                  <InlineNotice
                    message={
                      locale === "ar"
                        ? "هذا القبو مقيد حالياً ولن يتابع الإفراج أو تعديل القواعد حتى يرفع المشغلون التقييد."
                        : "This vault is currently restricted and will not progress through release or rule changes until operators release the restriction."
                    }
                    tone="warning"
                  />
                ) : null}
              </View>
            ))
          )}
        </SectionCard>
      </AnimatedSection>
    </AppScreen>
  );
}
