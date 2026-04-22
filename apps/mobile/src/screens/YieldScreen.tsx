import { Alert, View } from "react-native";
import { useEffect, useMemo, useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { AppScreen } from "../components/ui/AppScreen";
import { AppButton } from "../components/ui/AppButton";
import { AppText } from "../components/ui/AppText";
import { FeatureActionCard } from "../components/ui/FeatureActionCard";
import { FieldInput } from "../components/ui/FieldInput";
import { InlineNotice } from "../components/ui/InlineNotice";
import { ScreenHeaderActions } from "../components/ui/ScreenHeaderActions";
import { OptionChips } from "../components/ui/OptionChips";
import { SectionCard } from "../components/ui/SectionCard";
import { AnimatedSection } from "../components/ui/AnimatedSection";
import {
  useClaimRewardMutation,
  useEmergencyWithdrawMutation,
  useStakeDepositMutation,
  useStakingSnapshotQuery,
  useStakeWithdrawalMutation
} from "../hooks/use-customer-queries";
import { useLocale } from "../i18n/use-locale";
import { useT } from "../i18n/use-t";
import {
  formatShortAddress,
  formatTokenAmount,
  isPositiveDecimalString
} from "../lib/finance";
import { useSessionStore } from "../stores/session-store";

type YieldPrimaryAction = "stake" | "withdraw" | "claim";

type YieldScreenProps = {
  initialFocus?: YieldPrimaryAction;
};

export function YieldScreen({ initialFocus }: YieldScreenProps = {}) {
  const t = useT();
  const { locale } = useLocale();
  const user = useSessionStore((state) => state.user);
  const snapshotQuery = useStakingSnapshotQuery();
  const depositMutation = useStakeDepositMutation();
  const withdrawMutation = useStakeWithdrawalMutation();
  const claimMutation = useClaimRewardMutation();
  const emergencyMutation = useEmergencyWithdrawMutation();
  const [selectedPoolId, setSelectedPoolId] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [activeAction, setActiveAction] = useState<YieldPrimaryAction>(
    initialFocus ?? "stake"
  );
  const pools = snapshotQuery.data?.pools ?? [];
  const selectedPool =
    pools.find((pool) => String(pool.id) === selectedPoolId) ?? pools[0] ?? null;
  const executionEnabled = snapshotQuery.data?.execution.available ?? false;
  const actionBusy =
    depositMutation.isPending ||
    withdrawMutation.isPending ||
    claimMutation.isPending ||
    emergencyMutation.isPending;

  useEffect(() => {
    if (initialFocus) {
      setActiveAction(initialFocus);
    }
  }, [initialFocus]);

  const heroTitle = useMemo(() => {
    switch (activeAction) {
      case "claim":
        return t("yield.claimReward");
      case "withdraw":
        return t("yield.withdraw");
      default:
        return t("wallet.stake");
    }
  }, [activeAction, t]);

  const heroDescription = useMemo(() => {
    switch (activeAction) {
      case "claim":
        return t("yield.claimDescription");
      case "withdraw":
        return t("yield.withdrawDescription");
      default:
        return t("yield.stakeDescription");
    }
  }, [activeAction, t]);

  async function runAction(
    action: () => Promise<{ transactionHash: string }>,
    onSuccess?: () => void
  ) {
    try {
      const result = await action();
      onSuccess?.();
      Alert.alert(t("yield.title"), result.transactionHash);
    } catch (requestError) {
      Alert.alert(
        t("yield.title"),
        requestError instanceof Error ? requestError.message : String(requestError)
      );
    }
  }

  return (
    <AppScreen
      title={t("yield.title")}
      subtitle={t("yield.description")}
      trailing={<ScreenHeaderActions />}
    >
      {snapshotQuery.isError ? (
        <InlineNotice
          message={
            snapshotQuery.error instanceof Error
              ? snapshotQuery.error.message
              : t("common.notAvailable")
          }
          tone="critical"
        />
      ) : null}

      <AnimatedSection delayOrder={1} variant="up">
        <View className="overflow-hidden rounded-[36px] bg-ink px-5 py-6">
          <View className="absolute -right-10 -top-8 h-32 w-32 rounded-full bg-white/10" />
          <View className="absolute bottom-0 left-0 h-24 w-24 rounded-tr-[40px] bg-sea/20" />
          <View className="gap-4">
            <View className="gap-2">
              <AppText className="text-sm uppercase tracking-[1.3px] text-sea" weight="semibold">
                {t("yield.primaryActions")}
              </AppText>
              <AppText className="text-3xl text-white" weight="bold">
                {heroTitle}
              </AppText>
              <AppText className="text-sm leading-6 text-sand">
                {heroDescription}
              </AppText>
            </View>
            <View className="flex-row flex-wrap gap-3">
              <View className="min-w-[46%] flex-1 rounded-[24px] bg-white/8 px-4 py-4">
                <AppText className="text-xs uppercase tracking-[1.2px] text-sea">
                  {t("yield.pools")}
                </AppText>
                <AppText className="mt-2 text-3xl text-white" weight="bold">
                  {pools.length}
                </AppText>
              </View>
              <View className="min-w-[46%] flex-1 rounded-[24px] bg-white/8 px-4 py-4">
                <AppText className="text-xs uppercase tracking-[1.2px] text-sea">
                  {t("yield.execution")}
                </AppText>
                <AppText className="mt-2 text-base text-white" weight="semibold">
                  {executionEnabled
                    ? t("yield.executionEnabled")
                    : t("yield.executionPolicyGated")}
                </AppText>
              </View>
            </View>
          </View>
        </View>
      </AnimatedSection>

      <AnimatedSection delayOrder={2}>
        <View className="gap-3">
          <AppText className="text-xl text-ink" weight="bold">
            {t("yield.primaryActions")}
          </AppText>
          <View className="flex-row flex-wrap gap-3">
            <View className="min-w-[31%] flex-1">
              <FeatureActionCard
                active={activeAction === "stake"}
                compact
                description={t("yield.stakeShort")}
                icon="chart-timeline-variant"
                label={t("wallet.stake")}
                onPress={() => setActiveAction("stake")}
                tone={activeAction === "stake" ? "dark" : "light"}
              />
            </View>
            <View className="min-w-[31%] flex-1">
              <FeatureActionCard
                active={activeAction === "withdraw"}
                compact
                description={t("yield.withdrawShort")}
                icon="bank-transfer-out"
                label={t("yield.withdraw")}
                onPress={() => setActiveAction("withdraw")}
                tone={activeAction === "withdraw" ? "dark" : "light"}
              />
            </View>
            <View className="min-w-[31%] flex-1">
              <FeatureActionCard
                active={activeAction === "claim"}
                compact
                description={t("yield.claimShort")}
                icon="cash-fast"
                label={t("yield.claimReward")}
                onPress={() => setActiveAction("claim")}
                tone={activeAction === "claim" ? "dark" : "accent"}
              />
            </View>
          </View>
        </View>
      </AnimatedSection>

      <AnimatedSection delayOrder={3}>
        <SectionCard className="gap-4">
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-1 gap-1">
              <AppText className="text-xl text-ink" weight="bold">
                {heroTitle}
              </AppText>
              <AppText className="text-sm leading-6 text-slate">
                {heroDescription}
              </AppText>
            </View>
            <View className="h-11 w-11 items-center justify-center rounded-2xl bg-ink/6">
              <MaterialCommunityIcons
                color="#14212b"
                name={
                  activeAction === "stake"
                    ? "chart-timeline-variant"
                    : activeAction === "claim"
                      ? "cash-fast"
                      : "bank-transfer-out"
                }
                size={22}
              />
            </View>
          </View>

          {pools.length === 0 ? (
            <AppText className="text-sm text-slate">{t("yield.noPools")}</AppText>
          ) : (
            <>
              <OptionChips
                onChange={setSelectedPoolId}
                options={pools.map((pool) => ({
                  label: `${t("yield.poolLabel")} ${pool.id}`,
                  value: String(pool.id)
                }))}
                value={selectedPool ? String(selectedPool.id) : ""}
              />

              {selectedPool ? (
                <View className="flex-row flex-wrap gap-3">
                  <View className="min-w-[30%] flex-1 rounded-[22px] bg-white px-4 py-4">
                    <AppText className="text-xs text-slate">
                      {t("yield.totalStaked")}
                    </AppText>
                    <AppText className="mt-2 text-base text-ink" weight="bold">
                      {formatTokenAmount(selectedPool.totalStakedAmount, locale)} ETH
                    </AppText>
                  </View>
                  <View className="min-w-[30%] flex-1 rounded-[22px] bg-white px-4 py-4">
                    <AppText className="text-xs text-slate">
                      {t("yield.stakedBalance")}
                    </AppText>
                    <AppText className="mt-2 text-base text-ink" weight="bold">
                      {formatTokenAmount(selectedPool.position.stakedBalance, locale)} ETH
                    </AppText>
                  </View>
                  <View className="min-w-[30%] flex-1 rounded-[22px] bg-white px-4 py-4">
                    <AppText className="text-xs text-slate">
                      {t("yield.pendingReward")}
                    </AppText>
                    <AppText className="mt-2 text-base text-ink" weight="bold">
                      {formatTokenAmount(selectedPool.position.pendingReward, locale)} ETH
                    </AppText>
                  </View>
                </View>
              ) : null}

              <InlineNotice
                message={snapshotQuery.data?.execution.message ?? t("common.loading")}
                tone={executionEnabled ? "positive" : "warning"}
              />

              {snapshotQuery.data && !snapshotQuery.data.readModel.available ? (
                <InlineNotice
                  message={
                    snapshotQuery.data.readModel.message || t("yield.readModelLimited")
                  }
                  tone="warning"
                />
              ) : null}

              {selectedPool && activeAction === "stake" ? (
                <>
                  <FieldInput
                    keyboardType="decimal-pad"
                    label={t("yield.deposit")}
                    onChangeText={setDepositAmount}
                    value={depositAmount}
                  />
                  <AppButton
                    disabled={!executionEnabled || actionBusy}
                    label={t("yield.deposit")}
                    onPress={() => {
                      if (!isPositiveDecimalString(depositAmount)) {
                        Alert.alert(t("yield.title"), t("wallet.amountInvalid"));
                        return;
                      }

                      void runAction(
                        () =>
                          depositMutation.mutateAsync({
                            amount: depositAmount,
                            poolId: selectedPool.id
                          }),
                        () => setDepositAmount("")
                      );
                    }}
                  />
                </>
              ) : null}

              {selectedPool && activeAction === "withdraw" ? (
                <>
                  <FieldInput
                    keyboardType="decimal-pad"
                    label={t("yield.withdraw")}
                    onChangeText={setWithdrawAmount}
                    value={withdrawAmount}
                  />
                  <AppButton
                    disabled={!executionEnabled || actionBusy}
                    label={t("yield.withdraw")}
                    onPress={() => {
                      if (!isPositiveDecimalString(withdrawAmount)) {
                        Alert.alert(t("yield.title"), t("wallet.amountInvalid"));
                        return;
                      }

                      void runAction(
                        () =>
                          withdrawMutation.mutateAsync({
                            amount: withdrawAmount,
                            poolId: selectedPool.id
                          }),
                        () => setWithdrawAmount("")
                      );
                    }}
                  />
                </>
              ) : null}

              {selectedPool && activeAction === "claim" ? (
                <AppButton
                  disabled={!executionEnabled || actionBusy}
                  label={t("yield.claimReward")}
                  onPress={() => {
                    void runAction(() =>
                      claimMutation.mutateAsync({ poolId: selectedPool.id })
                    );
                  }}
                />
              ) : null}
            </>
          )}
        </SectionCard>
      </AnimatedSection>

      <AnimatedSection delayOrder={4}>
        <View className="gap-1 px-1">
          <AppText className="text-xl text-ink" weight="bold">
            {t("yield.secondaryTools")}
          </AppText>
          <AppText className="text-sm leading-6 text-slate">
            {t("yield.secondaryToolsDescription")}
          </AppText>
        </View>
      </AnimatedSection>

      <AnimatedSection delayOrder={5}>
        <SectionCard className="gap-4">
          <View className="flex-row flex-wrap gap-3">
            <View className="min-w-[30%] flex-1 rounded-[22px] bg-white px-4 py-4">
              <AppText className="text-xs text-slate">{t("yield.payoutWallet")}</AppText>
              <AppText className="mt-2 text-base text-ink" weight="bold">
                {formatShortAddress(user?.ethereumAddress, t("common.notAvailable"))}
              </AppText>
            </View>
            <View className="min-w-[30%] flex-1 rounded-[22px] bg-white px-4 py-4">
              <AppText className="text-xs text-slate">{t("yield.poolStatus")}</AppText>
              <AppText className="mt-2 text-base text-ink" weight="bold">
                {selectedPool?.poolStatus ?? t("common.notAvailable")}
              </AppText>
            </View>
            <View className="min-w-[30%] flex-1 rounded-[22px] bg-white px-4 py-4">
              <AppText className="text-xs text-slate">{t("yield.rewardsPaid")}</AppText>
              <AppText className="mt-2 text-base text-ink" weight="bold">
                {selectedPool
                  ? `${formatTokenAmount(selectedPool.totalRewardsPaid, locale)} ETH`
                  : t("common.notAvailable")}
              </AppText>
            </View>
          </View>

          {selectedPool && !selectedPool.position.canReadPosition ? (
            <InlineNotice
              message={t("yield.positionUnavailable")}
              tone="warning"
            />
          ) : null}

          <AppButton
            disabled={!executionEnabled || actionBusy || !selectedPool}
            label={t("yield.emergencyWithdraw")}
            onPress={() => {
              if (!selectedPool) {
                return;
              }

              void runAction(() =>
                emergencyMutation.mutateAsync({ poolId: selectedPool.id })
              );
            }}
            variant="secondary"
          />
        </SectionCard>
      </AnimatedSection>
    </AppScreen>
  );
}
