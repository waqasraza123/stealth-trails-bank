import { View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { formatRelativeTimeLabel, isTimestampOlderThan } from "@stealth-trails-bank/ui-foundation";
import { AppScreen } from "../components/ui/AppScreen";
import { AppButton } from "../components/ui/AppButton";
import { AppText } from "../components/ui/AppText";
import { InlineNotice } from "../components/ui/InlineNotice";
import { LanguageToggle } from "../components/ui/LanguageToggle";
import { SectionCard } from "../components/ui/SectionCard";
import { StatusChip } from "../components/ui/StatusChip";
import { useBalancesQuery, useTransactionHistoryQuery } from "../hooks/use-customer-queries";
import { useLocale } from "../i18n/use-locale";
import { useT } from "../i18n/use-t";
import {
  formatIntentAmount,
  formatIntentStatusLabel,
  formatShortAddress,
  getIntentStatusTone,
  normalizeIntentTypeLabel
} from "../lib/finance";
import { useSessionStore } from "../stores/session-store";

export function DashboardScreen() {
  const t = useT();
  const { locale } = useLocale();
  const navigation = useNavigation<any>();
  const user = useSessionStore((state) => state.user);
  const balancesQuery = useBalancesQuery();
  const historyQuery = useTransactionHistoryQuery(5);
  const balances = balancesQuery.data?.balances ?? [];
  const intents = historyQuery.data?.intents ?? [];
  const pendingAssetCount = balances.filter(
    (balance) => Number(balance.pendingBalance) > 0
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
    <AppScreen
      title={t("dashboard.title")}
      subtitle={t("dashboard.description")}
      trailing={<LanguageToggle />}
    >
      {balancesQuery.isError ? (
        <InlineNotice
          message={
            balancesQuery.error instanceof Error
              ? balancesQuery.error.message
              : t("common.notAvailable")
          }
          tone="critical"
        />
      ) : null}

      <SectionCard className="gap-4 bg-ink">
        <AppText className="text-sm text-sea" weight="semibold">
          {t("dashboard.managedWallet")}
        </AppText>
        <AppText className="text-2xl text-white" weight="bold">
          {formatShortAddress(user?.ethereumAddress, t("wallet.noWallet"))}
        </AppText>
        <AppButton
          label={t("navigation.loans")}
          onPress={() => navigation.navigate("Loans")}
          variant="secondary"
        />
      </SectionCard>

      <View className="flex-row flex-wrap gap-3">
        <SectionCard className="min-w-[30%] flex-1 gap-2">
          <AppText className="text-xs uppercase tracking-[1px] text-slate">
            {t("dashboard.availableAssets")}
          </AppText>
          <AppText className="text-3xl text-ink" weight="bold">
            {balances.length}
          </AppText>
        </SectionCard>
        <SectionCard className="min-w-[30%] flex-1 gap-2">
          <AppText className="text-xs uppercase tracking-[1px] text-slate">
            {t("dashboard.pendingAssets")}
          </AppText>
          <AppText className="text-3xl text-ink" weight="bold">
            {pendingAssetCount}
          </AppText>
        </SectionCard>
        <SectionCard className="min-w-[30%] flex-1 gap-2">
          <AppText className="text-xs uppercase tracking-[1px] text-slate">
            {t("dashboard.moneyMovement")}
          </AppText>
          <AppText className="text-3xl text-ink" weight="bold">
            {intents.length}
          </AppText>
        </SectionCard>
      </View>

      <InlineNotice
        message={
          staleOperationalData
            ? t("dashboard.latestSnapshotStale")
            : t("dashboard.latestSnapshotFresh")
        }
        tone={staleOperationalData ? "warning" : "positive"}
      />

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
            {intents.slice(0, 3).map((intent) => (
              <View
                key={intent.id}
                className="gap-3 rounded-2xl border border-border bg-white px-4 py-4"
              >
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1 gap-1">
                    <AppText className="text-sm text-ink" weight="semibold">
                      {normalizeIntentTypeLabel(intent.intentType, locale)}
                    </AppText>
                    <AppText className="text-base text-ink" weight="bold">
                      {formatIntentAmount(
                        intent.settledAmount ?? intent.requestedAmount,
                        intent.asset.symbol,
                        intent.intentType,
                        locale
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
            ))}
          </View>
        )}
      </SectionCard>
    </AppScreen>
  );
}
