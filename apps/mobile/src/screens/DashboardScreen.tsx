import { Pressable, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  formatRelativeTimeLabel,
  isTimestampOlderThan
} from "@stealth-trails-bank/ui-foundation";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { AppScreen } from "../components/ui/AppScreen";
import { AppButton } from "../components/ui/AppButton";
import { AppText } from "../components/ui/AppText";
import { FeatureActionCard } from "../components/ui/FeatureActionCard";
import { InlineNotice } from "../components/ui/InlineNotice";
import { ScreenHeaderActions } from "../components/ui/ScreenHeaderActions";
import { SectionCard } from "../components/ui/SectionCard";
import { StatusChip } from "../components/ui/StatusChip";
import { AnimatedSection } from "../components/ui/AnimatedSection";
import {
  useBalancesQuery,
  useRetirementVaultsQuery,
  useTransactionHistoryQuery
} from "../hooks/use-customer-queries";
import { useLocale } from "../i18n/use-locale";
import { useT } from "../i18n/use-t";
import {
  formatIntentAmount,
  formatIntentStatusLabel,
  formatShortAddress,
  formatTokenAmount,
  getIntentStatusTone,
  normalizeIntentTypeLabel
} from "../lib/finance";
import { useSessionStore } from "../stores/session-store";
import type { DashboardNavigationProp } from "../navigation/types";

export function DashboardScreen() {
  const t = useT();
  const { locale } = useLocale();
  const navigation = useNavigation<DashboardNavigationProp>();
  const user = useSessionStore((state) => state.user);
  const balancesQuery = useBalancesQuery();
  const retirementVaultsQuery = useRetirementVaultsQuery();
  const historyQuery = useTransactionHistoryQuery(5);
  const balances = balancesQuery.data?.balances ?? [];
  const vaults = retirementVaultsQuery.data?.vaults ?? [];
  const intents = historyQuery.data?.intents ?? [];
  const pendingAssetCount = balances.filter(
    (balance) => Number(balance.pendingBalance) > 0
  ).length;
  const fundedAssetCount = balances.filter(
    (balance) =>
      Number(balance.availableBalance) > 0 || Number(balance.pendingBalance) > 0
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
  const lockedVaultBalance = vaults.reduce(
    (sum, vault) => sum + Number.parseFloat(vault.lockedBalance || "0"),
    0
  );
  const nextVaultUnlock = vaults
    .map((vault) => vault.unlockAt)
    .sort((left, right) => Date.parse(left) - Date.parse(right))[0];

  return (
    <AppScreen
      title={t("dashboard.title")}
      subtitle={t("dashboard.description")}
      trailing={<ScreenHeaderActions />}
    >
      {balancesQuery.isError ? (
        <AnimatedSection delayOrder={1}>
          <InlineNotice
            message={
              balancesQuery.error instanceof Error
                ? balancesQuery.error.message
                : t("common.notAvailable")
            }
            tone="critical"
          />
        </AnimatedSection>
      ) : null}

      <AnimatedSection delayOrder={2} variant="up">
        <View className="overflow-hidden rounded-[36px] bg-ink px-5 py-6">
          <View className="absolute -right-10 -top-8 h-32 w-32 rounded-full bg-white/10" />
          <View className="absolute bottom-0 left-0 h-24 w-24 rounded-tr-[40px] bg-sea/20" />
          <View className="gap-4">
            <View className="gap-2">
              <AppText className="text-sm uppercase tracking-[1.4px] text-sea" weight="semibold">
                {t("dashboard.managedWallet")}
              </AppText>
              <AppText className="text-2xl text-white" weight="bold">
                {formatShortAddress(user?.ethereumAddress, t("wallet.noWallet"))}
              </AppText>
              <AppText className="text-sm leading-6 text-sand">
                {t("dashboard.primaryActionsDescription")}
              </AppText>
            </View>
            <View className="flex-row flex-wrap gap-3">
              <View className="min-w-[46%] flex-1 rounded-[24px] bg-white/8 px-4 py-4">
                <AppText className="text-xs uppercase tracking-[1.2px] text-sea">
                  {t("dashboard.fundedAssets")}
                </AppText>
                <AppText className="mt-2 text-3xl text-white" weight="bold">
                  {fundedAssetCount}
                </AppText>
              </View>
              <View className="min-w-[46%] flex-1 rounded-[24px] bg-white/8 px-4 py-4">
                <AppText className="text-xs uppercase tracking-[1.2px] text-sea">
                  {t("dashboard.pendingReview")}
                </AppText>
                <AppText className="mt-2 text-3xl text-white" weight="bold">
                  {pendingAssetCount}
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
                  ? "أموال محمية تبقى خارج السحب العادي وتتحرك فقط إلى رصيد مقفل."
                  : "Protected funds stay outside normal withdrawals and move only into a locked balance."}
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
                  ? formatRelativeTimeLabel(nextVaultUnlock, locale)
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
            {t("dashboard.primaryActions")}
          </AppText>
          <View className="flex-row flex-wrap gap-3">
            <View className="min-w-[47%] flex-1">
              <FeatureActionCard
                description={t("dashboard.actionDepositDescription")}
                icon="arrow-down-bold-circle-outline"
                label={t("wallet.deposit")}
                onPress={() => navigation.navigate("Wallet", { focus: "deposit" })}
                testID="dashboard-action-deposit"
                tone="dark"
              />
            </View>
            <View className="min-w-[47%] flex-1">
              <FeatureActionCard
                description={t("dashboard.actionWithdrawDescription")}
                icon="bank-transfer-out"
                label={t("wallet.withdraw")}
                onPress={() => navigation.navigate("Wallet", { focus: "withdraw" })}
                testID="dashboard-action-withdraw"
                tone="light"
              />
            </View>
            <View className="min-w-[47%] flex-1">
              <FeatureActionCard
                description={t("dashboard.actionSendDescription")}
                icon="send-circle-outline"
                label={t("wallet.send")}
                onPress={() => navigation.navigate("Wallet", { focus: "send" })}
                testID="dashboard-action-send"
                tone="accent"
              />
            </View>
            <View className="min-w-[47%] flex-1">
              <FeatureActionCard
                description={
                  locale === "ar"
                    ? "أنشئ القبو أو موّله"
                    : "Create or fund the vault"
                }
                icon="shield-lock-outline"
                label={locale === "ar" ? "قبو التقاعد" : "Retirement Vault"}
                onPress={() => navigation.navigate("RetirementVault", { focus: "fund" })}
                testID="dashboard-action-retirement-vault"
                tone="dark"
              />
            </View>
            <View className="min-w-[47%] flex-1">
              <FeatureActionCard
                description={t("dashboard.actionStakeDescription")}
                icon="chart-timeline-variant"
                label={t("wallet.stake")}
                onPress={() => navigation.navigate("Yield", { focus: "stake" })}
                testID="dashboard-action-stake"
                tone="light"
              />
            </View>
          </View>
        </View>
      </AnimatedSection>

      <AnimatedSection delayOrder={5}>
        <InlineNotice
          message={
            staleOperationalData
              ? t("dashboard.latestSnapshotStale")
              : t("dashboard.latestSnapshotFresh")
          }
          tone={staleOperationalData ? "warning" : "positive"}
        />
      </AnimatedSection>

      <AnimatedSection delayOrder={6}>
        <SectionCard className="gap-4">
          <View className="flex-row items-center justify-between">
            <View className="gap-1">
              <AppText className="text-xl text-ink" weight="bold">
                {t("dashboard.moreTools")}
              </AppText>
              <AppText className="text-sm leading-6 text-slate">
                {t("dashboard.moreToolsDescription")}
              </AppText>
            </View>
          </View>
          <View className="gap-3">
            <Pressable
              className="flex-row items-center justify-between rounded-[24px] border border-border bg-white px-4 py-4"
              onPress={() => navigation.navigate("Transactions")}
            >
              <View className="flex-row items-center gap-3">
                <View className="h-10 w-10 items-center justify-center rounded-2xl bg-ink/6">
                  <MaterialCommunityIcons color="#14212b" name="timeline-text-outline" size={20} />
                </View>
                <View className="gap-1">
                  <AppText className="text-base text-ink" weight="semibold">
                    {t("dashboard.viewHistory")}
                  </AppText>
                  <AppText className="text-sm text-slate">
                    {t("dashboard.viewHistoryDescription")}
                  </AppText>
                </View>
              </View>
              <MaterialCommunityIcons color="#72808d" name="chevron-right" size={22} />
            </Pressable>
            <Pressable
              className="flex-row items-center justify-between rounded-[24px] border border-border bg-white px-4 py-4"
              onPress={() => navigation.navigate("Loans")}
            >
              <View className="flex-row items-center gap-3">
                <View className="h-10 w-10 items-center justify-center rounded-2xl bg-ink/6">
                  <MaterialCommunityIcons color="#14212b" name="hand-coin-outline" size={20} />
                </View>
                <View className="gap-1">
                  <AppText className="text-base text-ink" weight="semibold">
                    {t("navigation.loans")}
                  </AppText>
                  <AppText className="text-sm text-slate">
                    {t("dashboard.loansDescription")}
                  </AppText>
                </View>
              </View>
              <MaterialCommunityIcons color="#72808d" name="chevron-right" size={22} />
            </Pressable>
            <Pressable
              className="flex-row items-center justify-between rounded-[24px] border border-border bg-white px-4 py-4"
              onPress={() => navigation.navigate("Profile")}
            >
              <View className="flex-row items-center gap-3">
                <View className="h-10 w-10 items-center justify-center rounded-2xl bg-ink/6">
                  <MaterialCommunityIcons color="#14212b" name="shield-account-outline" size={20} />
                </View>
                <View className="gap-1">
                  <AppText className="text-base text-ink" weight="semibold">
                    {t("navigation.profile")}
                  </AppText>
                  <AppText className="text-sm text-slate">
                    {t("dashboard.profileDescription")}
                  </AppText>
                </View>
              </View>
              <MaterialCommunityIcons color="#72808d" name="chevron-right" size={22} />
            </Pressable>
          </View>
        </SectionCard>
      </AnimatedSection>

      <AnimatedSection delayOrder={7}>
        <SectionCard className="gap-4">
          <View className="flex-row items-center justify-between">
            <AppText className="text-xl text-ink" weight="bold">
              {t("dashboard.recentActivity")}
            </AppText>
            <AppButton
              label={t("dashboard.viewHistory")}
              onPress={() => navigation.navigate("Transactions")}
              variant="ghost"
              fullWidth={false}
            />
          </View>
          {historyQuery.isError ? (
            <InlineNotice
              message={
                historyQuery.error instanceof Error
                  ? historyQuery.error.message
                  : t("common.notAvailable")
              }
              tone="critical"
            />
          ) : intents.length === 0 ? (
            <AppText className="text-sm leading-6 text-slate">
              {t("dashboard.noRecentActivity")}
            </AppText>
          ) : (
            <View className="gap-3">
              {intents.slice(0, 3).map((intent, index) => (
                <AnimatedSection key={intent.id} delayOrder={index + 1}>
                  <View className="gap-3 rounded-2xl border border-border bg-white px-4 py-4">
                    <View className="flex-row items-start justify-between gap-3">
                      <View className="flex-1 gap-1">
                        <AppText className="text-sm text-ink" weight="semibold">
                          {normalizeIntentTypeLabel(
                            intent.intentType,
                            locale,
                            intent.transferDirection
                          )}
                        </AppText>
                        <AppText className="text-base text-ink" weight="bold">
                          {formatIntentAmount(
                            intent.settledAmount ?? intent.requestedAmount,
                            intent.asset.symbol,
                            intent.intentType,
                            locale,
                            intent.transferDirection
                          )}
                        </AppText>
                        <AppText className="text-xs text-slate">
                          {formatRelativeTimeLabel(intent.updatedAt, locale)}
                        </AppText>
                      </View>
                      <StatusChip
                        label={formatIntentStatusLabel(intent.status, locale)}
                        tone={getIntentStatusTone(intent.status)}
                      />
                    </View>
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
