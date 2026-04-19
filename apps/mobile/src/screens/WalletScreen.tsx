import * as Clipboard from "expo-clipboard";
import { Alert, View } from "react-native";
import { useState } from "react";
import QRCode from "react-native-qrcode-svg";
import type {
  CreateDepositIntentResult,
  CreateWithdrawalIntentResult
} from "../lib/api/types";
import { useSessionStore } from "../stores/session-store";
import { AppScreen } from "../components/ui/AppScreen";
import { AppButton } from "../components/ui/AppButton";
import { AppText } from "../components/ui/AppText";
import { FieldInput } from "../components/ui/FieldInput";
import { InlineNotice } from "../components/ui/InlineNotice";
import { LanguageToggle } from "../components/ui/LanguageToggle";
import { OptionChips } from "../components/ui/OptionChips";
import { SectionCard } from "../components/ui/SectionCard";
import { StatusChip } from "../components/ui/StatusChip";
import { TimelineList } from "../components/ui/TimelineList";
import { AnimatedSection } from "../components/ui/AnimatedSection";
import {
  useBalancesQuery,
  useCreateDepositIntentMutation,
  useCreateWithdrawalIntentMutation,
  useSupportedAssetsQuery
} from "../hooks/use-customer-queries";
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
  isEthereumAddress,
  isPositiveDecimalString
} from "../lib/finance";

export function WalletScreen() {
  const t = useT();
  const { locale } = useLocale();
  const user = useSessionStore((state) => state.user);
  const rememberRequestKey = useSessionStore((state) => state.rememberRequestKey);
  const consumeRequestKey = useSessionStore((state) => state.consumeRequestKey);
  const clearRequestKey = useSessionStore((state) => state.clearRequestKey);
  const assetsQuery = useSupportedAssetsQuery();
  const balancesQuery = useBalancesQuery();
  const depositMutation = useCreateDepositIntentMutation();
  const withdrawalMutation = useCreateWithdrawalIntentMutation();
  const assets = assetsQuery.data?.assets ?? [];
  const balances = balancesQuery.data?.balances ?? [];
  const [showQr, setShowQr] = useState(false);
  const [depositAsset, setDepositAsset] = useState("");
  const [withdrawAsset, setWithdrawAsset] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [latestDeposit, setLatestDeposit] =
    useState<CreateDepositIntentResult | null>(null);
  const [latestWithdrawal, setLatestWithdrawal] =
    useState<CreateWithdrawalIntentResult | null>(null);
  const assetOptions = assets.map((asset) => ({
    label: asset.symbol,
    value: asset.symbol
  }));
  const activeDepositAsset = depositAsset || assets[0]?.symbol || "";
  const activeWithdrawAsset = withdrawAsset || assets[0]?.symbol || "";
  const selectedBalance =
    balances.find((balance) => balance.asset.symbol === activeWithdrawAsset) ?? null;

  function getIdempotencyKey(signature: string, prefix: string) {
    const existing = consumeRequestKey(signature);

    if (existing) {
      return existing;
    }

    const nextKey = buildRequestIdempotencyKey(prefix);
    rememberRequestKey(signature, nextKey);
    return nextKey;
  }

  async function handleCopyAddress() {
    if (!user?.ethereumAddress) {
      return;
    }

    await Clipboard.setStringAsync(user.ethereumAddress);
    Alert.alert(t("wallet.title"), t("wallet.depositAddressCopied"));
  }

  async function handleDeposit() {
    if (!activeDepositAsset) {
      Alert.alert(t("wallet.deposit"), t("wallet.selectAsset"));
      return;
    }

    if (!isPositiveDecimalString(depositAmount)) {
      Alert.alert(t("wallet.deposit"), t("wallet.amountInvalid"));
      return;
    }

    const signature = JSON.stringify({
      assetSymbol: activeDepositAsset,
      amount: depositAmount.trim()
    });

    try {
      const result = await depositMutation.mutateAsync({
        idempotencyKey: getIdempotencyKey(signature, "deposit_req"),
        assetSymbol: activeDepositAsset,
        amount: depositAmount.trim()
      });
      clearRequestKey(signature);
      setLatestDeposit(result);
      setDepositAmount("");
      Alert.alert(
        t("wallet.deposit"),
        result.intent.status === "review_required"
          ? t("wallet.depositReviewRecorded")
          : t("wallet.depositRecorded")
      );
    } catch (requestError) {
      Alert.alert(
        t("wallet.deposit"),
        requestError instanceof Error ? requestError.message : String(requestError)
      );
    }
  }

  async function handleWithdrawal() {
    if (!activeWithdrawAsset) {
      Alert.alert(t("wallet.withdraw"), t("wallet.selectAsset"));
      return;
    }

    if (!isEthereumAddress(withdrawAddress)) {
      Alert.alert(t("wallet.withdraw"), t("wallet.destinationInvalid"));
      return;
    }

    if (
      user?.ethereumAddress &&
      withdrawAddress.trim().toLowerCase() === user.ethereumAddress.toLowerCase()
    ) {
      Alert.alert(t("wallet.withdraw"), t("wallet.selfAddressInvalid"));
      return;
    }

    if (!isPositiveDecimalString(withdrawAmount)) {
      Alert.alert(t("wallet.withdraw"), t("wallet.amountInvalid"));
      return;
    }

    if (
      selectedBalance &&
      compareDecimalStrings(
        withdrawAmount.trim(),
        selectedBalance.availableBalance
      ) === 1
    ) {
      Alert.alert(t("wallet.withdraw"), t("wallet.insufficientBalance"));
      return;
    }

    const signature = JSON.stringify({
      assetSymbol: activeWithdrawAsset,
      amount: withdrawAmount.trim(),
      destinationAddress: withdrawAddress.trim().toLowerCase()
    });

    try {
      const result = await withdrawalMutation.mutateAsync({
        idempotencyKey: getIdempotencyKey(signature, "withdraw_req"),
        assetSymbol: activeWithdrawAsset,
        amount: withdrawAmount.trim(),
        destinationAddress: withdrawAddress.trim()
      });
      clearRequestKey(signature);
      setLatestWithdrawal(result);
      setWithdrawAmount("");
      setWithdrawAddress("");
      Alert.alert(t("wallet.withdraw"), t("wallet.withdrawalRecorded"));
    } catch (requestError) {
      Alert.alert(
        t("wallet.withdraw"),
        requestError instanceof Error ? requestError.message : String(requestError)
      );
    }
  }

  return (
    <AppScreen
      title={t("wallet.title")}
      subtitle={t("wallet.description")}
      trailing={<LanguageToggle />}
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
        <SectionCard className="gap-4">
          <AppText className="text-xl text-ink" weight="bold">
            {t("wallet.walletReference")}
          </AppText>
          <AppText className="text-2xl text-ink" weight="bold">
            {formatShortAddress(user?.ethereumAddress, t("wallet.noWallet"), 10, 6)}
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

      <AnimatedSection delayOrder={3}>
        <SectionCard className="gap-4">
          <AppText className="text-xl text-ink" weight="bold">
            {t("wallet.balances")}
          </AppText>
          {balances.length === 0 ? (
            <AppText className="text-sm text-slate">{t("common.noData")}</AppText>
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
                      {formatTokenAmount(balance.availableBalance, locale)} available
                    </AppText>
                    <AppText className="text-sm text-slate">
                      {formatTokenAmount(balance.pendingBalance, locale)} pending
                    </AppText>
                  </View>
                </AnimatedSection>
              ))}
            </View>
          )}
        </SectionCard>
      </AnimatedSection>

      <AnimatedSection delayOrder={4}>
        <SectionCard className="gap-4">
          <AppText className="text-xl text-ink" weight="bold">
            {t("wallet.deposit")}
          </AppText>
          <InlineNotice message={t("wallet.depositSecurityNote")} tone="warning" />
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
                    <AppText className="text-base text-ink" weight="semibold">
                      {t("wallet.latestDepositRequest")}
                    </AppText>
                    <AppText className="text-sm text-slate">
                      {t("wallet.reference")}: {latestDeposit.intent.id}
                    </AppText>
                  </View>
                  <StatusChip
                    label={formatIntentStatusLabel(latestDeposit.intent.status, locale)}
                    tone={getIntentStatusTone(latestDeposit.intent.status)}
                  />
                </View>
                <TimelineList events={buildIntentTimeline(latestDeposit.intent)} />
                {latestDeposit.intent.status === "review_required" ? (
                  <InlineNotice
                    message={t("wallet.depositReviewStatusNote")}
                    tone="warning"
                  />
                ) : null}
              </View>
            </AnimatedSection>
          ) : null}
        </SectionCard>
      </AnimatedSection>

      <AnimatedSection delayOrder={5}>
        <SectionCard className="gap-4">
          <AppText className="text-xl text-ink" weight="bold">
            {t("wallet.withdraw")}
          </AppText>
          <InlineNotice message={t("wallet.reservationNote")} tone="warning" />
          <OptionChips
            onChange={setWithdrawAsset}
            options={assetOptions}
            value={activeWithdrawAsset}
          />
          <AppText className="text-sm text-slate">
            {selectedBalance
              ? `${formatTokenAmount(selectedBalance.availableBalance, locale)} available / ${formatTokenAmount(
                  selectedBalance.pendingBalance,
                  locale
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
            disabled={withdrawalMutation.isPending}
            label={t("wallet.createWithdrawalRequest")}
            onPress={() => {
              void handleWithdrawal();
            }}
          />
          {latestWithdrawal ? (
            <AnimatedSection delayOrder={1}>
              <View className="gap-3 rounded-2xl border border-border bg-white px-4 py-4">
                <View className="flex-row items-center justify-between gap-3">
                  <View className="flex-1 gap-1">
                    <AppText className="text-base text-ink" weight="semibold">
                      {t("wallet.latestWithdrawalRequest")}
                    </AppText>
                    <AppText className="text-sm text-slate">
                      {t("wallet.reference")}: {latestWithdrawal.intent.id}
                    </AppText>
                  </View>
                  <StatusChip
                    label={formatIntentStatusLabel(latestWithdrawal.intent.status, locale)}
                    tone={getIntentStatusTone(latestWithdrawal.intent.status)}
                  />
                </View>
                <TimelineList events={buildIntentTimeline(latestWithdrawal.intent)} />
              </View>
            </AnimatedSection>
          ) : null}
        </SectionCard>
      </AnimatedSection>
    </AppScreen>
  );
}
