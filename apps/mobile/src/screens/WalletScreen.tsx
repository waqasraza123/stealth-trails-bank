import * as Clipboard from "expo-clipboard";
import { View } from "react-native";
import { useEffect, useMemo, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import QRCode from "react-native-qrcode-svg";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type {
  CreateBalanceTransferResult,
  CreateDepositIntentResult,
  PreviewBalanceTransferRecipientResult,
  CreateWithdrawalIntentResult,
} from "../lib/api/types";
import { useSessionStore } from "../stores/session-store";
import { AppScreen } from "../components/ui/AppScreen";
import { AppButton } from "../components/ui/AppButton";
import { AppText } from "../components/ui/AppText";
import { FeatureActionCard } from "../components/ui/FeatureActionCard";
import { FieldInput } from "../components/ui/FieldInput";
import { InlineNotice } from "../components/ui/InlineNotice";
import { ScreenHeaderActions } from "../components/ui/ScreenHeaderActions";
import { LtrValue } from "../components/ui/LtrValue";
import { OptionChips } from "../components/ui/OptionChips";
import { SectionCard } from "../components/ui/SectionCard";
import { StatusChip } from "../components/ui/StatusChip";
import { TimelineList } from "../components/ui/TimelineList";
import { AnimatedSection } from "../components/ui/AnimatedSection";
import {
  useBalancesQuery,
  useCreateRetirementVaultMutation,
  useCreateBalanceTransferMutation,
  useCreateDepositIntentMutation,
  usePreviewBalanceTransferRecipientMutation,
  useCreateWithdrawalIntentMutation,
  useFundRetirementVaultMutation,
  useRetirementVaultsQuery,
  useStartMfaChallengeMutation,
  useSupportedAssetsQuery,
  useVerifyMfaChallengeMutation,
} from "../hooks/use-customer-queries";
import { useScreenFeedback } from "../hooks/use-app-feedback";
import { useLocale } from "../i18n/use-locale";
import { useT } from "../i18n/use-t";
import {
  buildIntentTimeline,
  buildRequestIdempotencyKey,
  compareDecimalStrings,
  formatDateLabel,
  formatShortAddress,
  formatTokenAmount,
  formatIntentStatusLabel,
  getIntentStatusTone,
  isPositiveIntegerString,
  isEthereumAddress,
  isPositiveDecimalString,
} from "../lib/finance";

type WalletPrimaryAction = "deposit" | "withdraw" | "send";

type WalletScreenProps = {
  initialFocus?: WalletPrimaryAction;
};

export function WalletScreen({ initialFocus }: WalletScreenProps = {}) {
  const t = useT();
  const { locale } = useLocale();
  const feedback = useScreenFeedback();
  const navigation = useNavigation<any>();
  const user = useSessionStore((state) => state.user);
  const rememberRequestKey = useSessionStore(
    (state) => state.rememberRequestKey,
  );
  const consumeRequestKey = useSessionStore((state) => state.consumeRequestKey);
  const clearRequestKey = useSessionStore((state) => state.clearRequestKey);
  const assetsQuery = useSupportedAssetsQuery();
  const balancesQuery = useBalancesQuery();
  const retirementVaultsQuery = useRetirementVaultsQuery();
  const depositMutation = useCreateDepositIntentMutation();
  const sendMutation = useCreateBalanceTransferMutation();
  const previewSendRecipientMutation = usePreviewBalanceTransferRecipientMutation();
  const withdrawalMutation = useCreateWithdrawalIntentMutation();
  const createRetirementVaultMutation = useCreateRetirementVaultMutation();
  const fundRetirementVaultMutation = useFundRetirementVaultMutation();
  const startMfaChallengeMutation = useStartMfaChallengeMutation();
  const verifyMfaChallengeMutation = useVerifyMfaChallengeMutation();
  const assets = assetsQuery.data?.assets ?? [];
  const balances = balancesQuery.data?.balances ?? [];
  const vaults = retirementVaultsQuery.data?.vaults ?? [];
  const [showQr, setShowQr] = useState(false);
  const [depositAsset, setDepositAsset] = useState("");
  const [withdrawAsset, setWithdrawAsset] = useState("");
  const [sendAsset, setSendAsset] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [sendEmail, setSendEmail] = useState("");
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [vaultCreateAsset, setVaultCreateAsset] = useState("");
  const [vaultFundAsset, setVaultFundAsset] = useState("");
  const [vaultFundAmount, setVaultFundAmount] = useState("");
  const [vaultUnlockYears, setVaultUnlockYears] = useState("10");
  const [vaultStrictMode, setVaultStrictMode] = useState("strict");
  const [activeAction, setActiveAction] = useState<WalletPrimaryAction>(
    initialFocus ?? "deposit",
  );
  const [latestDeposit, setLatestDeposit] =
    useState<CreateDepositIntentResult | null>(null);
  const [latestWithdrawal, setLatestWithdrawal] =
    useState<CreateWithdrawalIntentResult | null>(null);
  const [latestInternalTransfer, setLatestInternalTransfer] =
    useState<CreateBalanceTransferResult | null>(null);
  const [sendPreview, setSendPreview] =
    useState<PreviewBalanceTransferRecipientResult | null>(null);
  const [withdrawalChallengeId, setWithdrawalChallengeId] = useState<
    string | null
  >(null);
  const [withdrawalChallengeMethod, setWithdrawalChallengeMethod] = useState<
    "totp" | "email_otp"
  >("totp");
  const [withdrawalChallengeCode, setWithdrawalChallengeCode] = useState("");
  const [withdrawalPreviewCode, setWithdrawalPreviewCode] = useState<
    string | null
  >(null);
  const assetOptions = assets.map((asset) => ({
    label: asset.symbol,
    value: asset.symbol,
  }));
  const activeDepositAsset = depositAsset || assets[0]?.symbol || "";
  const activeSendAsset = sendAsset || assets[0]?.symbol || "";
  const activeWithdrawAsset = withdrawAsset || assets[0]?.symbol || "";
  const activeVaultCreateAsset = vaultCreateAsset || assets[0]?.symbol || "";
  const activeVaultFundAsset =
    vaultFundAsset || vaults[0]?.asset.symbol || "";
  const selectedSendBalance =
    balances.find((balance) => balance.asset.symbol === activeSendAsset) ?? null;
  const selectedBalance =
    balances.find((balance) => balance.asset.symbol === activeWithdrawAsset) ??
    null;
  const selectedVaultFundBalance =
    balances.find((balance) => balance.asset.symbol === activeVaultFundAsset) ??
    null;
  const fundedAssetCount = balances.filter(
    (balance) =>
      Number(balance.availableBalance) > 0 ||
      Number(balance.pendingBalance) > 0,
  ).length;

  useEffect(() => {
    if (initialFocus) {
      setActiveAction(initialFocus);
    }
  }, [initialFocus]);

  const highlightedActionTitle = useMemo(() => {
    switch (activeAction) {
      case "send":
        return t("wallet.send");
      case "withdraw":
        return t("wallet.withdraw");
      default:
        return t("wallet.deposit");
    }
  }, [activeAction, t]);

  const highlightedActionDescription = useMemo(() => {
    switch (activeAction) {
      case "send":
        return t("wallet.sendDescription");
      case "withdraw":
        return t("wallet.withdrawDescription");
      default:
        return t("wallet.depositDescription");
    }
  }, [activeAction, t]);

  const moneyMovementBlocked = user?.mfa?.moneyMovementBlocked ?? true;
  const sessionRequiresVerification =
    user?.sessionSecurity?.currentSessionRequiresVerification ?? false;
  const stepUpFresh =
    Boolean(user?.mfa?.stepUpFreshUntil) &&
    Date.parse(user?.mfa?.stepUpFreshUntil ?? "") > Date.now();
  const lockedVaultBalance = vaults.reduce(
    (sum, vault) => sum + Number.parseFloat(vault.lockedBalance || "0"),
    0,
  );
  const nextVaultUnlock = vaults
    .map((vault) => vault.unlockAt)
    .sort((left, right) => Date.parse(left) - Date.parse(right))[0];
  const normalizedSendEmail = sendEmail.trim().toLowerCase();
  const normalizedSendAmount = sendAmount.trim();
  const sendAvailableBalance = selectedSendBalance?.availableBalance ?? "0";
  const sendAmountValid = isPositiveDecimalString(normalizedSendAmount);
  const sendAmountExceedsAvailable =
    sendAmountValid &&
    compareDecimalStrings(normalizedSendAmount, sendAvailableBalance) === 1;
  const sendPreviewMatchesCurrentInput =
    sendPreview?.available === true &&
    sendPreview.normalizedEmail === normalizedSendEmail &&
    sendAmountValid;
  const canUseMaxSendAmount =
    compareDecimalStrings(sendAvailableBalance, "0") === 1;
  const sendSubmitDisabled =
    sendMutation.isPending ||
    moneyMovementBlocked ||
    sessionRequiresVerification ||
    !stepUpFresh ||
    !normalizedSendEmail ||
    !sendAmountValid ||
    sendAmountExceedsAvailable ||
    !sendPreviewMatchesCurrentInput;
  const walletTitle = t("wallet.title");
  const depositTitle = t("wallet.deposit");
  const withdrawTitle = t("wallet.withdraw");
  const sendTitle = t("wallet.send");
  const retirementVaultTitle =
    locale === "ar" ? "قبو التقاعد" : "Retirement Vault";
  const recipientEmailMessage =
    locale === "ar" ? "أدخل بريد المستلم." : "Enter the recipient email.";

  function showInfo(title: string, message: string) {
    feedback.info(message, { title });
  }

  function showSuccess(title: string, message: string) {
    feedback.success(message, { title });
  }

  function showWarning(title: string, message: string) {
    feedback.warning(message, { title });
  }

  function showError(title: string, error: unknown) {
    feedback.errorFrom(error, undefined, { title });
  }

  function getIdempotencyKey(signature: string, prefix: string) {
    const existing = consumeRequestKey(signature);

    if (existing) {
      return existing;
    }

    const nextKey = buildRequestIdempotencyKey(prefix);
    rememberRequestKey(signature, nextKey);
    return nextKey;
  }

  function handleUseMaxSendAmount() {
    if (!canUseMaxSendAmount) {
      return;
    }

    setSendAmount(sendAvailableBalance);
    setSendPreview(null);
  }

  async function handleCopyAddress() {
    if (!user?.ethereumAddress) {
      return;
    }

    await Clipboard.setStringAsync(user.ethereumAddress);
    showInfo(walletTitle, t("wallet.depositAddressCopied"));
  }

  async function handleDeposit() {
    if (!activeDepositAsset) {
      showWarning(depositTitle, t("wallet.selectAsset"));
      return;
    }

    if (!isPositiveDecimalString(depositAmount)) {
      showWarning(depositTitle, t("wallet.amountInvalid"));
      return;
    }

    const signature = JSON.stringify({
      assetSymbol: activeDepositAsset,
      amount: depositAmount.trim(),
    });

    try {
      const result = await depositMutation.mutateAsync({
        idempotencyKey: getIdempotencyKey(signature, "deposit_req"),
        assetSymbol: activeDepositAsset,
        amount: depositAmount.trim(),
      });
      clearRequestKey(signature);
      setLatestDeposit(result);
      setDepositAmount("");
      showSuccess(
        depositTitle,
        result.intent.status === "review_required"
          ? t("wallet.depositReviewRecorded")
          : t("wallet.depositRecorded")
      );
    } catch (requestError) {
      showError(depositTitle, requestError);
    }
  }

  async function handleWithdrawal() {
    if (moneyMovementBlocked) {
      showWarning(withdrawTitle, t("wallet.mfaSetupRequired"));
      return;
    }

    if (sessionRequiresVerification) {
      showWarning(withdrawTitle, t("wallet.sessionVerificationRequired"));
      return;
    }

    if (!stepUpFresh) {
      showWarning(withdrawTitle, t("wallet.mfaStepUpRequired"));
      return;
    }

    if (!activeWithdrawAsset) {
      showWarning(withdrawTitle, t("wallet.selectAsset"));
      return;
    }

    if (!isEthereumAddress(withdrawAddress)) {
      showWarning(withdrawTitle, t("wallet.destinationInvalid"));
      return;
    }

    if (
      user?.ethereumAddress &&
      withdrawAddress.trim().toLowerCase() ===
        user.ethereumAddress.toLowerCase()
    ) {
      showWarning(withdrawTitle, t("wallet.selfAddressInvalid"));
      return;
    }

    if (!isPositiveDecimalString(withdrawAmount)) {
      showWarning(withdrawTitle, t("wallet.amountInvalid"));
      return;
    }

    if (
      selectedBalance &&
      compareDecimalStrings(
        withdrawAmount.trim(),
        selectedBalance.availableBalance,
      ) === 1
    ) {
      showWarning(withdrawTitle, t("wallet.insufficientBalance"));
      return;
    }

    const signature = JSON.stringify({
      assetSymbol: activeWithdrawAsset,
      amount: withdrawAmount.trim(),
      destinationAddress: withdrawAddress.trim().toLowerCase(),
    });

    try {
      const result = await withdrawalMutation.mutateAsync({
        idempotencyKey: getIdempotencyKey(signature, "withdraw_req"),
        assetSymbol: activeWithdrawAsset,
        amount: withdrawAmount.trim(),
        destinationAddress: withdrawAddress.trim(),
      });
      clearRequestKey(signature);
      setLatestWithdrawal(result);
      setWithdrawAmount("");
      setWithdrawAddress("");
      showSuccess(withdrawTitle, t("wallet.withdrawalRecorded"));
    } catch (requestError) {
      showError(withdrawTitle, requestError);
    }
  }

  async function handlePreviewSendRecipient() {
    if (moneyMovementBlocked) {
      showWarning(sendTitle, t("wallet.mfaSetupRequired"));
      return;
    }

    if (sessionRequiresVerification) {
      showWarning(sendTitle, t("wallet.sessionVerificationRequired"));
      return;
    }

    if (!sendEmail.trim()) {
      showWarning(sendTitle, recipientEmailMessage);
      return;
    }

    try {
      const result = await previewSendRecipientMutation.mutateAsync({
        email: sendEmail.trim(),
        assetSymbol: activeSendAsset || undefined,
        amount: sendAmount.trim() || undefined,
      });
      setSendPreview(result);

      if (!result.available) {
        showWarning(
          sendTitle,
          locale === "ar"
            ? "هذا البريد غير متاح كعميل نشط للتحويل الداخلي."
            : "That email is not available as an active internal recipient."
        );
        return;
      }

      showSuccess(
        sendTitle,
        locale === "ar"
          ? `تم التحقق من المستلم: ${result.maskedDisplay ?? result.maskedEmail ?? "عميل داخلي"}`
          : `Recipient verified: ${result.maskedDisplay ?? result.maskedEmail ?? "Internal customer"}`
      );
    } catch (requestError) {
      showError(sendTitle, requestError);
    }
  }

  async function handleInternalTransfer() {
    if (moneyMovementBlocked) {
      showWarning(sendTitle, t("wallet.mfaSetupRequired"));
      return;
    }

    if (sessionRequiresVerification) {
      showWarning(sendTitle, t("wallet.sessionVerificationRequired"));
      return;
    }

    if (!stepUpFresh) {
      showWarning(sendTitle, t("wallet.mfaStepUpRequired"));
      return;
    }

    if (!activeSendAsset) {
      showWarning(sendTitle, t("wallet.selectAsset"));
      return;
    }

    if (!sendEmail.trim()) {
      showWarning(sendTitle, recipientEmailMessage);
      return;
    }

    if (!isPositiveDecimalString(sendAmount)) {
      showWarning(sendTitle, t("wallet.amountInvalid"));
      return;
    }

    if (
      selectedSendBalance &&
      compareDecimalStrings(sendAmount.trim(), selectedSendBalance.availableBalance) === 1
    ) {
      showWarning(sendTitle, t("wallet.insufficientBalance"));
      return;
    }

    if (!sendPreviewMatchesCurrentInput) {
      showWarning(
        sendTitle,
        locale === "ar"
          ? "تحقق من المستلم لهذا البريد والمبلغ أولاً."
          : "Verify the recipient for this email and amount first."
      );
      return;
    }

    const signature = JSON.stringify({
      assetSymbol: activeSendAsset,
      amount: sendAmount.trim(),
      recipientEmail: sendEmail.trim().toLowerCase(),
    });

    try {
      const result = await sendMutation.mutateAsync({
        idempotencyKey: getIdempotencyKey(signature, "internal_transfer_req"),
        assetSymbol: activeSendAsset,
        amount: sendAmount.trim(),
        recipientEmail: sendEmail.trim(),
      });
      clearRequestKey(signature);
      setLatestInternalTransfer(result);
      setSendAmount("");
      setSendEmail("");
      setSendPreview(null);
      showSuccess(
        sendTitle,
        result.thresholdOutcome === "review_required"
          ? locale === "ar"
            ? "تم حجز الرصيد وإرسال التحويل إلى مراجعة تشغيلية."
            : "The balance was reserved and the transfer was sent to operator review."
          : locale === "ar"
            ? "تمت تسوية التحويل داخلياً فوراً."
            : "The transfer settled internally immediately."
      );
    } catch (requestError) {
      showError(sendTitle, requestError);
    }
  }

  async function startWithdrawalStepUp(method: "totp" | "email_otp") {
    try {
      const result = await startMfaChallengeMutation.mutateAsync({
        method,
        purpose: "withdrawal_step_up",
      });
      setWithdrawalChallengeMethod(method);
      setWithdrawalChallengeId(result.challengeId);
      setWithdrawalChallengeCode("");
      setWithdrawalPreviewCode(result.previewCode);
      showInfo(
        withdrawTitle,
        locale === "ar"
          ? "أرسلنا رمز التحقق لهذا الإجراء. أكمل التحقق لمتابعة السحب."
          : "We sent a verification code for this action. Complete the challenge to continue the withdrawal."
      );
    } catch (requestError) {
      showError(withdrawTitle, requestError);
    }
  }

  async function verifyWithdrawalStepUp() {
    if (!withdrawalChallengeId) {
      return;
    }

    try {
      await verifyMfaChallengeMutation.mutateAsync({
        challengeId: withdrawalChallengeId,
        method: withdrawalChallengeMethod,
        purpose: "withdrawal_step_up",
        code: withdrawalChallengeCode.trim(),
      });
      setWithdrawalChallengeId(null);
      setWithdrawalChallengeCode("");
      setWithdrawalPreviewCode(null);
      showSuccess(withdrawTitle, t("wallet.mfaStepUpReady"));
    } catch (requestError) {
      showError(withdrawTitle, requestError);
    }
  }

  async function handleCreateRetirementVault() {
    if (!activeVaultCreateAsset) {
      showWarning(
        retirementVaultTitle,
        locale === "ar"
          ? "اختر أصلاً قبل إنشاء القبو."
          : "Select an asset before creating the vault."
      );
      return;
    }

    if (!isPositiveIntegerString(vaultUnlockYears)) {
      showWarning(
        retirementVaultTitle,
        locale === "ar"
          ? "أدخل عدداً صحيحاً من السنوات."
          : "Enter a whole number of years."
      );
      return;
    }

    const unlockAt = new Date();
    unlockAt.setUTCFullYear(
      unlockAt.getUTCFullYear() + Number.parseInt(vaultUnlockYears, 10),
    );

    try {
      const result = await createRetirementVaultMutation.mutateAsync({
        assetSymbol: activeVaultCreateAsset,
        unlockAt: unlockAt.toISOString(),
        strictMode: vaultStrictMode === "strict",
      });

      setVaultFundAsset(result.vault.asset.symbol);
      showSuccess(
        retirementVaultTitle,
        result.created
          ? locale === "ar"
            ? "تم إنشاء القبو ويمكنك تمويله الآن."
            : "The vault was created and can be funded now."
          : locale === "ar"
            ? "القبو موجود بالفعل لهذا الأصل."
            : "A vault already exists for this asset."
      );
    } catch (requestError) {
      showError(retirementVaultTitle, requestError);
    }
  }

  async function handleFundRetirementVault() {
    if (!activeVaultFundAsset) {
      showWarning(
        retirementVaultTitle,
        locale === "ar"
          ? "أنشئ قبو تقاعد أولاً."
          : "Create a retirement vault first."
      );
      return;
    }

    if (!isPositiveDecimalString(vaultFundAmount)) {
      showWarning(
        retirementVaultTitle,
        locale === "ar"
          ? "أدخل مبلغاً موجباً صالحاً."
          : "Enter a valid positive amount."
      );
      return;
    }

    if (
      selectedVaultFundBalance &&
      compareDecimalStrings(
        vaultFundAmount.trim(),
        selectedVaultFundBalance.availableBalance,
      ) === 1
    ) {
      showWarning(
        retirementVaultTitle,
        locale === "ar"
          ? "المبلغ يتجاوز الرصيد المتاح."
          : "Amount exceeds the available balance."
      );
      return;
    }

    const signature = JSON.stringify({
      assetSymbol: activeVaultFundAsset,
      amount: vaultFundAmount.trim(),
    });

    try {
      await fundRetirementVaultMutation.mutateAsync({
        idempotencyKey: getIdempotencyKey(signature, "vault_fund_req"),
        assetSymbol: activeVaultFundAsset,
        amount: vaultFundAmount.trim(),
      });
      clearRequestKey(signature);
      setVaultFundAmount("");
      showSuccess(
        retirementVaultTitle,
        locale === "ar"
          ? "تم نقل الأموال إلى الرصيد المقفل."
          : "Funds were moved into the locked vault balance."
      );
    } catch (requestError) {
      showError(retirementVaultTitle, requestError);
    }
  }

  return (
    <AppScreen
      title={t("wallet.title")}
      subtitle={t("wallet.description")}
      trailing={<ScreenHeaderActions />}
    >
      {assetsQuery.isError ? (
        <AnimatedSection delayOrder={1}>
          <InlineNotice
            message={
              assetsQuery.error instanceof Error
                ? assetsQuery.error.message
                : t("common.notAvailable")
            }
            tone="critical"
          />
        </AnimatedSection>
      ) : null}

      <AnimatedSection delayOrder={2} variant="up">
        <View className="overflow-hidden rounded-[36px] bg-ink px-5 py-6">
          <View className="absolute -right-10 -top-6 h-32 w-32 rounded-full bg-white/10" />
          <View className="gap-4">
            <View className="gap-2">
              <AppText
                className="text-sm uppercase tracking-[1.3px] text-sea"
                weight="semibold"
              >
                {t("wallet.primaryActions")}
              </AppText>
              <AppText className="text-3xl text-white" weight="bold">
                {highlightedActionTitle}
              </AppText>
              <AppText className="text-sm leading-6 text-sand">
                {highlightedActionDescription}
              </AppText>
            </View>
            <View className="flex-row flex-wrap gap-3">
              <View className="min-w-[46%] flex-1 rounded-[24px] bg-white/8 px-4 py-4">
                <AppText className="text-xs uppercase tracking-[1.2px] text-sea">
                  {t("wallet.fundedAssets")}
                </AppText>
                <AppText className="mt-2 text-3xl text-white" weight="bold">
                  {fundedAssetCount}
                </AppText>
              </View>
              <View className="min-w-[46%] flex-1 rounded-[24px] bg-white/8 px-4 py-4">
                <AppText className="text-xs uppercase tracking-[1.2px] text-sea">
                  {t("wallet.walletReference")}
                </AppText>
                <AppText className="mt-2 text-sm text-white" weight="semibold">
                  {formatShortAddress(
                    user?.ethereumAddress,
                    t("wallet.noWallet"),
                    8,
                    6,
                  )}
                </AppText>
              </View>
            </View>
          </View>
        </View>
      </AnimatedSection>

      <AnimatedSection delayOrder={3}>
        <SectionCard className="gap-4">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1 gap-1">
              <AppText className="text-xl text-ink" weight="bold">
                {locale === "ar" ? "قبو التقاعد" : "Retirement Vault"}
              </AppText>
              <AppText className="text-sm leading-6 text-slate">
                {locale === "ar"
                  ? "رصيد محمي لا يظهر كرصيد متاح للسحب."
                  : "Protected balance that does not show up as spendable withdrawal balance."}
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
          <View className="flex-row flex-wrap gap-3">
            <View className="min-w-[46%] flex-1 rounded-[24px] bg-white px-4 py-4">
              <AppText className="text-xs uppercase tracking-[1.2px] text-slate">
                {locale === "ar" ? "الأموال المقفلة" : "Locked funds"}
              </AppText>
              <AppText className="mt-2 text-3xl text-ink" weight="bold">
                {retirementVaultsQuery.isLoading
                  ? "..."
                  : formatTokenAmount(String(lockedVaultBalance), locale)}
              </AppText>
            </View>
            <View className="min-w-[46%] flex-1 rounded-[24px] bg-white px-4 py-4">
              <AppText className="text-xs uppercase tracking-[1.2px] text-slate">
                {locale === "ar" ? "أقرب إفراج" : "Next release"}
              </AppText>
              <AppText className="mt-2 text-sm text-ink" weight="semibold">
                {nextVaultUnlock
                  ? formatDateLabel(nextVaultUnlock, locale)
                  : locale === "ar"
                    ? "لا يوجد بعد"
                    : "Not scheduled yet"}
              </AppText>
            </View>
          </View>
          <AppButton
            label={
              locale === "ar"
                ? "افتح قبو التقاعد"
                : "Open Retirement Vault"
            }
            onPress={() => navigation.navigate("RetirementVault", { focus: "fund" })}
          />
        </SectionCard>
      </AnimatedSection>

      <AnimatedSection delayOrder={4}>
        <View className="gap-3">
          <AppText className="text-xl text-ink" weight="bold">
            {t("wallet.primaryActions")}
          </AppText>
          <View className="flex-row flex-wrap gap-3">
            <View className="min-w-[31%] flex-1">
              <FeatureActionCard
                active={activeAction === "deposit"}
                compact
                description={t("wallet.depositShort")}
                icon="arrow-down-bold-circle-outline"
                label={t("wallet.deposit")}
                onPress={() => setActiveAction("deposit")}
                testID="wallet-action-deposit"
                tone={activeAction === "deposit" ? "dark" : "light"}
              />
            </View>
            <View className="min-w-[31%] flex-1">
              <FeatureActionCard
                active={activeAction === "withdraw"}
                compact
                description={t("wallet.withdrawShort")}
                icon="bank-transfer-out"
                label={t("wallet.withdraw")}
                onPress={() => setActiveAction("withdraw")}
                testID="wallet-action-withdraw"
                tone={activeAction === "withdraw" ? "dark" : "light"}
              />
            </View>
            <View className="min-w-[31%] flex-1">
              <FeatureActionCard
                active={activeAction === "send"}
                compact
                description={t("wallet.sendShort")}
                icon="send-circle-outline"
                label={t("wallet.send")}
                onPress={() => setActiveAction("send")}
                testID="wallet-action-send"
                tone={activeAction === "send" ? "dark" : "accent"}
              />
            </View>
          </View>
        </View>
      </AnimatedSection>

      <AnimatedSection delayOrder={5}>
        <SectionCard className="gap-4">
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-1 gap-1">
              <AppText className="text-xl text-ink" weight="bold">
                {locale === "ar" ? "إنشاء أو تمويل سريع" : "Quick create or fund"}
              </AppText>
              <AppText className="text-sm leading-6 text-slate">
                {locale === "ar"
                  ? "ابدأ القفل من المحفظة ثم افتح صفحة القبو للمراجعة الكاملة."
                  : "Start the lock from Wallet, then open the vault page for the full review surface."}
              </AppText>
            </View>
          </View>
          <OptionChips
            onChange={setVaultCreateAsset}
            options={assetOptions}
            value={activeVaultCreateAsset}
          />
          <FieldInput
            keyboardType="number-pad"
            label={locale === "ar" ? "سنوات القفل" : "Lock years"}
            onChangeText={setVaultUnlockYears}
            value={vaultUnlockYears}
          />
          <OptionChips
            onChange={setVaultStrictMode}
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
            value={vaultStrictMode}
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
              void handleCreateRetirementVault();
            }}
          />
          <OptionChips
            onChange={setVaultFundAsset}
            options={
              vaults.length > 0
                ? vaults.map((vault) => ({
                    label: vault.asset.symbol,
                    value: vault.asset.symbol,
                  }))
                : [
                    {
                      label: locale === "ar" ? "لا توجد أقبية" : "No vaults",
                      value: "",
                    },
                  ]
            }
            value={activeVaultFundAsset}
          />
          <FieldInput
            keyboardType="decimal-pad"
            label={locale === "ar" ? "مبلغ التمويل" : "Funding amount"}
            onChangeText={setVaultFundAmount}
            value={vaultFundAmount}
          />
          <InlineNotice
            message={
              selectedVaultFundBalance
                ? locale === "ar"
                  ? `الرصيد المتاح: ${formatTokenAmount(selectedVaultFundBalance.availableBalance, locale)} ${selectedVaultFundBalance.asset.symbol}`
                  : `Available balance: ${formatTokenAmount(selectedVaultFundBalance.availableBalance, locale)} ${selectedVaultFundBalance.asset.symbol}`
                : locale === "ar"
                  ? "أنشئ القبو أولاً لبدء التمويل."
                  : "Create the vault first to start funding."
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
              void handleFundRetirementVault();
            }}
          />
        </SectionCard>
      </AnimatedSection>

      <AnimatedSection delayOrder={6}>
        <SectionCard className="gap-4">
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-1 gap-1">
              <AppText className="text-xl text-ink" weight="bold">
                {highlightedActionTitle}
              </AppText>
              <AppText className="text-sm leading-6 text-slate">
                {highlightedActionDescription}
              </AppText>
            </View>
            <View className="h-11 w-11 items-center justify-center rounded-2xl bg-ink/6">
              <MaterialCommunityIcons
                color="#14212b"
                name={
                  activeAction === "deposit"
                    ? "arrow-down-bold-circle-outline"
                    : activeAction === "send"
                      ? "send-circle-outline"
                      : "bank-transfer-out"
                }
                size={22}
              />
            </View>
          </View>
          {activeAction === "deposit" ? (
            <>
              <InlineNotice
                message={t("wallet.depositSecurityNote")}
                tone="warning"
              />
              <OptionChips
                onChange={setDepositAsset}
                options={assetOptions}
                value={activeDepositAsset}
              />
              <FieldInput
                keyboardType="decimal-pad"
                label={t("wallet.amount")}
                onChangeText={setDepositAmount}
                value={depositAmount}
              />
              <AppButton
                disabled={depositMutation.isPending}
                label={t("wallet.createDepositRequest")}
                onPress={() => {
                  void handleDeposit();
                }}
              />
              {latestDeposit ? (
                <AnimatedSection delayOrder={1}>
                  <View className="gap-3 rounded-2xl border border-border bg-white px-4 py-4">
                    <View className="flex-row items-center justify-between gap-3">
                      <View className="flex-1 gap-1">
                        <AppText
                          className="text-base text-ink"
                          weight="semibold"
                        >
                          {t("wallet.latestDepositRequest")}
                        </AppText>
                        <AppText className="text-sm text-slate">
                          {t("wallet.reference")}: {latestDeposit.intent.id}
                        </AppText>
                      </View>
                      <StatusChip
                        label={formatIntentStatusLabel(
                          latestDeposit.intent.status,
                          locale,
                        )}
                        tone={getIntentStatusTone(latestDeposit.intent.status)}
                      />
                    </View>
                    <TimelineList
                      events={buildIntentTimeline(latestDeposit.intent)}
                    />
                    {latestDeposit.intent.status === "review_required" ? (
                      <InlineNotice
                        message={t("wallet.depositReviewStatusNote")}
                        tone="warning"
                      />
                    ) : null}
                  </View>
                </AnimatedSection>
              ) : null}
            </>
          ) : activeAction === "send" ? (
            <>
              {moneyMovementBlocked ? (
                <InlineNotice
                  message={t("wallet.mfaSetupRequired")}
                  tone="warning"
                />
              ) : sessionRequiresVerification ? (
                <InlineNotice
                  message={t("wallet.sessionVerificationRequired")}
                  tone="warning"
                />
              ) : !stepUpFresh ? (
                <View className="gap-3">
                  <InlineNotice
                    message={t("wallet.mfaStepUpRequired")}
                    tone="warning"
                  />
                  <View className="flex-row gap-3">
                    <AppButton
                      fullWidth={false}
                      label={t("wallet.mfaUseAuthenticator")}
                      onPress={() => {
                        void startWithdrawalStepUp("totp");
                      }}
                      variant="secondary"
                    />
                    {user?.mfa?.emailOtpEnrolled ? (
                      <AppButton
                        fullWidth={false}
                        label={t("wallet.mfaUseEmail")}
                        onPress={() => {
                          void startWithdrawalStepUp("email_otp");
                        }}
                        variant="secondary"
                      />
                    ) : null}
                  </View>
                  {withdrawalChallengeId ? (
                    <View className="gap-3 rounded-2xl border border-border bg-white px-4 py-4">
                      {withdrawalPreviewCode ? (
                        <LtrValue
                          value={`${t("wallet.mfaPreviewCode")}: ${withdrawalPreviewCode}`}
                        />
                      ) : null}
                      <FieldInput
                        keyboardType="number-pad"
                        label={t("wallet.mfaCodeLabel")}
                        onChangeText={setWithdrawalChallengeCode}
                        value={withdrawalChallengeCode}
                      />
                      <AppButton
                        disabled={verifyMfaChallengeMutation.isPending}
                        label={t("wallet.mfaVerifyStepUp")}
                        onPress={() => {
                          void verifyWithdrawalStepUp();
                        }}
                      />
                    </View>
                  ) : null}
                </View>
              ) : null}
              <InlineNotice
                message={t("wallet.sendRoutingNote")}
                tone="warning"
              />
              <OptionChips
                onChange={(value) => {
                  setSendAsset(value);
                  setSendPreview(null);
                }}
                options={assetOptions}
                value={activeSendAsset}
              />
              <AppText className="text-sm text-slate">
                {selectedSendBalance
                  ? `${formatTokenAmount(
                      selectedSendBalance.availableBalance,
                      locale,
                    )} available / ${formatTokenAmount(
                      selectedSendBalance.pendingBalance,
                      locale,
                    )} pending`
                  : t("common.notAvailable")}
              </AppText>
              <AppButton
                disabled={!canUseMaxSendAmount}
                fullWidth={false}
                label={locale === "ar" ? "استخدم الحد الأقصى" : "Use max"}
                onPress={handleUseMaxSendAmount}
                variant="ghost"
              />
              <FieldInput
                autoCapitalize="none"
                keyboardType="email-address"
                label={locale === "ar" ? "بريد المستلم" : "Recipient email"}
                onChangeText={(value) => {
                  setSendEmail(value);
                  setSendPreview(null);
                }}
                value={sendEmail}
              />
              <FieldInput
                keyboardType="decimal-pad"
                label={t("wallet.amount")}
                onChangeText={(value) => {
                  setSendAmount(value);
                  setSendPreview(null);
                }}
                value={sendAmount}
              />
              <AppButton
                disabled={previewSendRecipientMutation.isPending || !sendEmail.trim()}
                label={locale === "ar" ? "تحقق من المستلم" : "Verify recipient"}
                onPress={() => {
                  void handlePreviewSendRecipient();
                }}
                variant="secondary"
              />
              <InlineNotice
                message={
                  sendPreviewMatchesCurrentInput
                    ? sendPreview?.thresholdOutcome === "review_required"
                      ? locale === "ar"
                        ? "التحويل جاهز. سيُحجز الرصيد فور الإرسال ثم ينتظر المراجعة التشغيلية."
                        : "Transfer ready. The balance will be reserved immediately on submit and wait for operator review."
                      : locale === "ar"
                        ? "التحويل جاهز. سيُسوّى الرصيد داخلياً فور الإرسال."
                        : "Transfer ready. The balance will settle internally immediately on submit."
                    : !normalizedSendEmail || !normalizedSendAmount
                      ? locale === "ar"
                        ? "أدخل بريد المستلم والمبلغ ثم تحقّق من المستلم قبل الإرسال."
                        : "Enter the recipient email and amount, then verify the recipient before sending."
                      : sendAmountExceedsAvailable
                        ? locale === "ar"
                          ? "عدّل المبلغ ليبقى ضمن الرصيد المتاح ثم أعد التحقق."
                          : "Reduce the amount to stay within the available balance, then verify again."
                        : locale === "ar"
                          ? "تحتاج إلى التحقق من المستلم لهذا البريد والمبلغ قبل الإرسال."
                          : "You need to verify the recipient for this email and amount before sending."
                }
                tone={
                  sendPreviewMatchesCurrentInput
                    ? sendPreview?.thresholdOutcome === "review_required"
                      ? "warning"
                      : "positive"
                    : "neutral"
                }
              />
              {sendPreview?.available ? (
                <InlineNotice
                  message={
                    sendPreview.thresholdOutcome === "review_required"
                      ? locale === "ar"
                        ? `المستلم: ${sendPreview.maskedDisplay ?? sendPreview.maskedEmail ?? "عميل داخلي"} · سيتم حجز المبلغ ثم إرساله إلى مراجعة تشغيلية.`
                        : `Recipient: ${sendPreview.maskedDisplay ?? sendPreview.maskedEmail ?? "Internal customer"} · the amount will be reserved and sent to operator review.`
                      : locale === "ar"
                        ? `المستلم: ${sendPreview.maskedDisplay ?? sendPreview.maskedEmail ?? "عميل داخلي"} · سيتم إرسال الرصيد وتسويته داخلياً فوراً.`
                        : `Recipient: ${sendPreview.maskedDisplay ?? sendPreview.maskedEmail ?? "Internal customer"} · the balance will settle internally immediately.`
                  }
                  tone={
                    sendPreview.thresholdOutcome === "review_required"
                      ? "warning"
                      : "positive"
                  }
                />
              ) : null}
              <AppButton
                disabled={sendSubmitDisabled}
                label={t("wallet.createSendRequest")}
                onPress={() => {
                  void handleInternalTransfer();
                }}
              />
              {moneyMovementBlocked ? (
                <AppButton
                  label={t("wallet.openSecuritySetup")}
                  onPress={() => {
                    navigation.navigate("Profile");
                  }}
                  variant="secondary"
                />
              ) : null}
              {latestInternalTransfer ? (
                <AnimatedSection delayOrder={1}>
                  <View className="gap-3 rounded-2xl border border-border bg-white px-4 py-4">
                    <View className="flex-row items-center justify-between gap-3">
                      <View className="flex-1 gap-1">
                        <AppText
                          className="text-base text-ink"
                          weight="semibold"
                        >
                          {t("wallet.latestSendRequest")}
                        </AppText>
                        <AppText className="text-sm text-slate">
                          {t("wallet.reference")}: {latestInternalTransfer.intent.id}
                        </AppText>
                      </View>
                      <StatusChip
                        label={formatIntentStatusLabel(
                          latestInternalTransfer.intent.status,
                          locale,
                        )}
                        tone={getIntentStatusTone(
                          latestInternalTransfer.intent.status,
                        )}
                      />
                    </View>
                    <InlineNotice
                      message={
                        latestInternalTransfer.thresholdOutcome === "review_required"
                          ? locale === "ar"
                            ? "تم حجز الرصيد وما زال التحويل بانتظار قرار الفريق التشغيلي."
                            : "The balance is reserved and the transfer is waiting on operator review."
                          : locale === "ar"
                            ? "تمت تسوية التحويل داخل البنك مباشرة."
                            : "The transfer settled directly inside the bank."
                      }
                      tone={
                        latestInternalTransfer.thresholdOutcome === "review_required"
                          ? "warning"
                          : "positive"
                      }
                    />
                    <TimelineList
                      events={buildIntentTimeline(latestInternalTransfer.intent)}
                    />
                  </View>
                </AnimatedSection>
              ) : null}
            </>
          ) : (
            <>
              {moneyMovementBlocked ? (
                <InlineNotice
                  message={t("wallet.mfaSetupRequired")}
                  tone="warning"
                />
              ) : sessionRequiresVerification ? (
                <InlineNotice
                  message={t("wallet.sessionVerificationRequired")}
                  tone="warning"
                />
              ) : !stepUpFresh ? (
                <View className="gap-3">
                  <InlineNotice
                    message={t("wallet.mfaStepUpRequired")}
                    tone="warning"
                  />
                  <View className="flex-row gap-3">
                    <AppButton
                      fullWidth={false}
                      label={t("wallet.mfaUseAuthenticator")}
                      onPress={() => {
                        void startWithdrawalStepUp("totp");
                      }}
                      variant="secondary"
                    />
                    {user?.mfa?.emailOtpEnrolled ? (
                      <AppButton
                        fullWidth={false}
                        label={t("wallet.mfaUseEmail")}
                        onPress={() => {
                          void startWithdrawalStepUp("email_otp");
                        }}
                        variant="secondary"
                      />
                    ) : null}
                  </View>
                  {withdrawalChallengeId ? (
                    <View className="gap-3 rounded-2xl border border-border bg-white px-4 py-4">
                      {withdrawalPreviewCode ? (
                        <LtrValue
                          value={`${t("wallet.mfaPreviewCode")}: ${withdrawalPreviewCode}`}
                        />
                      ) : null}
                      <FieldInput
                        keyboardType="number-pad"
                        label={t("wallet.mfaCodeLabel")}
                        onChangeText={setWithdrawalChallengeCode}
                        value={withdrawalChallengeCode}
                      />
                      <AppButton
                        disabled={verifyMfaChallengeMutation.isPending}
                        label={t("wallet.mfaVerifyStepUp")}
                        onPress={() => {
                          void verifyWithdrawalStepUp();
                        }}
                      />
                    </View>
                  ) : null}
                </View>
              ) : null}
              <InlineNotice
                message={t("wallet.reservationNote")}
                tone="warning"
              />
              <OptionChips
                onChange={setWithdrawAsset}
                options={assetOptions}
                value={activeWithdrawAsset}
              />
              <AppText className="text-sm text-slate">
                {selectedBalance
                  ? `${formatTokenAmount(
                      selectedBalance.availableBalance,
                      locale,
                    )} available / ${formatTokenAmount(
                      selectedBalance.pendingBalance,
                      locale,
                    )} pending`
                  : t("common.notAvailable")}
              </AppText>
              <FieldInput
                autoCapitalize="none"
                label={t("wallet.destinationAddress")}
                onChangeText={setWithdrawAddress}
                value={withdrawAddress}
              />
              <FieldInput
                keyboardType="decimal-pad"
                label={t("wallet.amount")}
                onChangeText={setWithdrawAmount}
                value={withdrawAmount}
              />
              <AppButton
                disabled={
                  withdrawalMutation.isPending ||
                  moneyMovementBlocked ||
                  !stepUpFresh
                }
                label={t("wallet.createWithdrawalRequest")}
                onPress={() => {
                  void handleWithdrawal();
                }}
              />
              {moneyMovementBlocked ? (
                <AppButton
                  label={t("wallet.openSecuritySetup")}
                  onPress={() => {
                    navigation.navigate("Profile");
                  }}
                  variant="secondary"
                />
              ) : null}
              {latestWithdrawal ? (
                <AnimatedSection delayOrder={1}>
                  <View className="gap-3 rounded-2xl border border-border bg-white px-4 py-4">
                    <View className="flex-row items-center justify-between gap-3">
                      <View className="flex-1 gap-1">
                        <AppText
                          className="text-base text-ink"
                          weight="semibold"
                        >
                          {t("wallet.latestWithdrawalRequest")}
                        </AppText>
                        <AppText className="text-sm text-slate">
                          {t("wallet.reference")}: {latestWithdrawal.intent.id}
                        </AppText>
                      </View>
                      <StatusChip
                        label={formatIntentStatusLabel(
                          latestWithdrawal.intent.status,
                          locale,
                        )}
                        tone={getIntentStatusTone(
                          latestWithdrawal.intent.status,
                        )}
                      />
                    </View>
                    <TimelineList
                      events={buildIntentTimeline(latestWithdrawal.intent)}
                    />
                  </View>
                </AnimatedSection>
              ) : null}
            </>
          )}
        </SectionCard>
      </AnimatedSection>

      <AnimatedSection delayOrder={5}>
        <View className="gap-1 px-1">
          <AppText className="text-xl text-ink" weight="bold">
            {t("wallet.secondaryTools")}
          </AppText>
          <AppText className="text-sm leading-6 text-slate">
            {t("wallet.secondaryToolsDescription")}
          </AppText>
        </View>
      </AnimatedSection>

      <AnimatedSection delayOrder={6}>
        <SectionCard className="gap-4">
          <AppText className="text-xl text-ink" weight="bold">
            {t("wallet.walletReference")}
          </AppText>
          <AppText className="text-2xl text-ink" weight="bold">
            {formatShortAddress(
              user?.ethereumAddress,
              t("wallet.noWallet"),
              10,
              6,
            )}
          </AppText>
          <View className="flex-row gap-3">
            <AppButton
              label={t("wallet.copy")}
              onPress={() => {
                void handleCopyAddress();
              }}
              fullWidth={false}
              variant="secondary"
            />
            <AppButton
              label={showQr ? t("wallet.hideQr") : t("wallet.showQr")}
              onPress={() => setShowQr((current) => !current)}
              fullWidth={false}
              variant="secondary"
            />
          </View>
          {showQr && user?.ethereumAddress ? (
            <AnimatedSection delayOrder={1}>
              <View className="items-center rounded-3xl bg-white py-6">
                <QRCode value={user.ethereumAddress} size={160} />
              </View>
            </AnimatedSection>
          ) : null}
        </SectionCard>
      </AnimatedSection>

      <AnimatedSection delayOrder={7}>
        <SectionCard className="gap-4">
          <View className="flex-row items-center justify-between">
            <AppText className="text-xl text-ink" weight="bold">
              {t("wallet.balances")}
            </AppText>
          </View>
          {balances.length === 0 ? (
            <AppText className="text-sm text-slate">
              {t("common.noData")}
            </AppText>
          ) : (
            <View className="gap-3">
              {balances.map((balance, index) => (
                <AnimatedSection key={balance.asset.id} delayOrder={index + 1}>
                  <View className="rounded-2xl border border-border bg-white px-4 py-4">
                    <View className="flex-row items-center justify-between">
                      <AppText className="text-base text-ink" weight="semibold">
                        {balance.asset.symbol}
                      </AppText>
                      <AppText className="text-xs text-slate">
                        {formatDateLabel(balance.updatedAt, locale)}
                      </AppText>
                    </View>
                    <AppText className="mt-2 text-sm text-slate">
                      {formatTokenAmount(balance.availableBalance, locale)}{" "}
                      available
                    </AppText>
                    <AppText className="text-sm text-slate">
                      {formatTokenAmount(balance.pendingBalance, locale)}{" "}
                      pending
                    </AppText>
                  </View>
                </AnimatedSection>
              ))}
            </View>
          )}
        </SectionCard>
      </AnimatedSection>
    </AppScreen>
  );
}
