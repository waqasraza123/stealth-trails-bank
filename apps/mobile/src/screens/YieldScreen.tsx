import { Alert, View } from "react-native";
import { useState } from "react";
import { AppScreen } from "../components/ui/AppScreen";
import { AppButton } from "../components/ui/AppButton";
import { AppText } from "../components/ui/AppText";
import { FieldInput } from "../components/ui/FieldInput";
import { InlineNotice } from "../components/ui/InlineNotice";
import { LanguageToggle } from "../components/ui/LanguageToggle";
import { OptionChips } from "../components/ui/OptionChips";
import { SectionCard } from "../components/ui/SectionCard";
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

export function YieldScreen() {
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
  const pools = snapshotQuery.data?.pools ?? [];
  const selectedPool =
    pools.find((pool) => String(pool.id) === selectedPoolId) ?? pools[0] ?? null;
  const executionEnabled = snapshotQuery.data?.execution.available ?? false;
  const actionBusy =
    depositMutation.isPending ||
    withdrawMutation.isPending ||
    claimMutation.isPending ||
    emergencyMutation.isPending;

  async function runAction(action: () => Promise<{ transactionHash: string }>) {
    try {
      const result = await action();
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
      trailing={<LanguageToggle />}
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

      <SectionCard className="gap-4">
        <View className="flex-row flex-wrap gap-3">
          <SectionCard className="min-w-[30%] flex-1">
            <AppText className="text-xs text-slate">{t("yield.pools")}</AppText>
            <AppText className="mt-2 text-3xl text-ink" weight="bold">
              {pools.length}
            </AppText>
          </SectionCard>
          <SectionCard className="min-w-[30%] flex-1">
            <AppText className="text-xs text-slate">{t("yield.execution")}</AppText>
            <AppText className="mt-2 text-base text-ink" weight="bold">
              {executionEnabled ? "Enabled" : "Policy gated"}
            </AppText>
          </SectionCard>
          <SectionCard className="min-w-[30%] flex-1">
            <AppText className="text-xs text-slate">{t("yield.payoutWallet")}</AppText>
            <AppText className="mt-2 text-base text-ink" weight="bold">
              {formatShortAddress(user?.ethereumAddress, t("common.notAvailable"))}
            </AppText>
          </SectionCard>
        </View>
        <InlineNotice
          message={
            snapshotQuery.data?.execution.message ?? t("common.loading")
          }
          tone={executionEnabled ? "positive" : "warning"}
        />
        {snapshotQuery.data && !snapshotQuery.data.readModel.available ? (
          <InlineNotice
            message={snapshotQuery.data.readModel.message || t("yield.readModelLimited")}
            tone="warning"
          />
        ) : null}
      </SectionCard>

      <SectionCard className="gap-4">
        <AppText className="text-xl text-ink" weight="bold">
          {t("yield.pools")}
        </AppText>
        {pools.length === 0 ? (
          <AppText className="text-sm text-slate">{t("yield.noPools")}</AppText>
        ) : (
          <>
            <OptionChips
              onChange={setSelectedPoolId}
              options={pools.map((pool) => ({
                label: `Pool ${pool.id}`,
                value: String(pool.id)
              }))}
              value={selectedPool ? String(selectedPool.id) : ""}
            />
            {selectedPool ? (
              <View className="gap-3">
                <AppText className="text-sm text-slate">
                  {t("yield.totalStaked")}:{" "}
                  {formatTokenAmount(selectedPool.totalStakedAmount, locale)} ETH
                </AppText>
                <AppText className="text-sm text-slate">
                  {t("yield.pendingReward")}:{" "}
                  {formatTokenAmount(selectedPool.position.pendingReward, locale)} ETH
                </AppText>
                <AppText className="text-sm text-slate">
                  {t("yield.rewardsPaid")}:{" "}
                  {formatTokenAmount(selectedPool.totalRewardsPaid, locale)} ETH
                </AppText>
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

                    void runAction(() =>
                      depositMutation.mutateAsync({
                        amount: depositAmount,
                        poolId: selectedPool.id
                      })
                    );
                  }}
                />
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

                    void runAction(() =>
                      withdrawMutation.mutateAsync({
                        amount: withdrawAmount,
                        poolId: selectedPool.id
                      })
                    );
                  }}
                />
                <AppButton
                  disabled={!executionEnabled || actionBusy}
                  label={t("yield.claimReward")}
                  onPress={() => {
                    void runAction(() =>
                      claimMutation.mutateAsync({ poolId: selectedPool.id })
                    );
                  }}
                  variant="secondary"
                />
                <AppButton
                  disabled={!executionEnabled || actionBusy}
                  label={t("yield.emergencyWithdraw")}
                  onPress={() => {
                    void runAction(() =>
                      emergencyMutation.mutateAsync({ poolId: selectedPool.id })
                    );
                  }}
                  variant="secondary"
                />
              </View>
            ) : null}
          </>
        )}
      </SectionCard>
    </AppScreen>
  );
}
