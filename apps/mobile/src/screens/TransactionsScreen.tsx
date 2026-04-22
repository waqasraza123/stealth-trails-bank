import { Modal, Pressable, TextInput, View } from "react-native";
import { useMemo, useState } from "react";
import { AppScreen } from "../components/ui/AppScreen";
import { AppButton } from "../components/ui/AppButton";
import { AppText } from "../components/ui/AppText";
import { InlineNotice } from "../components/ui/InlineNotice";
import { ScreenHeaderActions } from "../components/ui/ScreenHeaderActions";
import { LtrValue } from "../components/ui/LtrValue";
import { OptionChips } from "../components/ui/OptionChips";
import { SectionCard } from "../components/ui/SectionCard";
import { StatusChip } from "../components/ui/StatusChip";
import { TimelineList } from "../components/ui/TimelineList";
import { AnimatedSection } from "../components/ui/AnimatedSection";
import { useTransactionHistoryQuery } from "../hooks/use-customer-queries";
import { useLocale } from "../i18n/use-locale";
import { useT } from "../i18n/use-t";
import type { TransactionHistoryIntent } from "../lib/api/types";
import {
  buildIntentTimeline,
  formatDateLabel,
  formatIntentAmount,
  formatIntentStatusLabel,
  getIntentStatusTone,
  normalizeIntentTypeLabel,
  resolveIntentAddress
} from "../lib/finance";

export function TransactionsScreen() {
  const t = useT();
  const { locale } = useLocale();
  const historyQuery = useTransactionHistoryQuery(100);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedIntent, setSelectedIntent] = useState<TransactionHistoryIntent | null>(
    null
  );
  const intents = historyQuery.data?.intents ?? [];

  const typeOptions = useMemo(
    () =>
      Array.from(new Set(intents.map((intent) => intent.intentType))).map((value) => ({
        label: normalizeIntentTypeLabel(value, locale),
        value
      })),
    [intents, locale]
  );
  const statusOptions = useMemo(
    () =>
      Array.from(new Set(intents.map((intent) => intent.status))).map((value) => ({
        label: value,
        value
      })),
    [intents]
  );

  const filteredIntents = intents.filter((intent) => {
    const query = search.trim().toLowerCase();
    const resolvedAddress = resolveIntentAddress(intent).toLowerCase();
    const matchesSearch =
      query.length === 0 ||
      intent.id.toLowerCase().includes(query) ||
      intent.asset.symbol.toLowerCase().includes(query) ||
      resolvedAddress.includes(query);

    const matchesType = !typeFilter || intent.intentType === typeFilter;
    const matchesStatus = !statusFilter || intent.status === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <AppScreen
      title={t("transactions.title")}
      subtitle={t("transactions.description")}
      trailing={<ScreenHeaderActions />}
    >
      <AnimatedSection delayOrder={1} variant="up">
        <SectionCard className="gap-4">
          <TextInput
            accessibilityLabel={t("transactions.searchPlaceholder")}
            className="rounded-2xl border border-border bg-white px-4 py-3 text-base text-ink"
            onChangeText={setSearch}
            placeholder={t("transactions.searchPlaceholder")}
            placeholderTextColor="#72808d"
            value={search}
          />
          {typeOptions.length > 0 ? (
            <OptionChips
              onChange={(value) => setTypeFilter(value === typeFilter ? "" : value)}
              options={[{ label: t("transactions.allTypes"), value: "" }, ...typeOptions]}
              value={typeFilter}
            />
          ) : null}
          {statusOptions.length > 0 ? (
            <OptionChips
              onChange={(value) =>
                setStatusFilter(value === statusFilter ? "" : value)
              }
              options={[
                { label: t("transactions.allStatuses"), value: "" },
                ...statusOptions
              ]}
              value={statusFilter}
            />
          ) : null}
        </SectionCard>
      </AnimatedSection>

      {historyQuery.isError ? (
        <AnimatedSection delayOrder={2}>
          <InlineNotice
            message={
              historyQuery.error instanceof Error
                ? historyQuery.error.message
                : t("common.notAvailable")
            }
            tone="critical"
          />
        </AnimatedSection>
      ) : null}

      <AnimatedSection delayOrder={3}>
        <SectionCard className="gap-3">
          {filteredIntents.length === 0 ? (
            <AppText className="text-sm text-slate">{t("transactions.empty")}</AppText>
          ) : (
            filteredIntents.map((intent, index) => (
              <AnimatedSection key={intent.id} delayOrder={index + 1}>
                <Pressable
                  className="gap-3 rounded-2xl border border-border bg-white px-4 py-4"
                  onPress={() => setSelectedIntent(intent)}
                >
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
                        {formatDateLabel(intent.createdAt, locale)}
                      </AppText>
                      <LtrValue
                        className="text-xs text-slate"
                        value={resolveIntentAddress(intent)}
                      />
                    </View>
                    <StatusChip
                      label={formatIntentStatusLabel(intent.status, locale)}
                      tone={getIntentStatusTone(intent.status)}
                    />
                  </View>
                </Pressable>
              </AnimatedSection>
            ))
          )}
        </SectionCard>
      </AnimatedSection>

      <Modal
        animationType="slide"
        onRequestClose={() => setSelectedIntent(null)}
        transparent
        visible={Boolean(selectedIntent)}
      >
        <View className="flex-1 justify-end bg-black/35">
          <View className="max-h-[80%] rounded-t-[32px] bg-parchment px-5 pb-10 pt-5">
            {selectedIntent ? (
              <View className="gap-4">
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1 gap-1">
                    <AppText className="text-2xl text-ink" weight="bold">
                      {normalizeIntentTypeLabel(
                        selectedIntent.intentType,
                        locale,
                        selectedIntent.transferDirection
                      )}
                    </AppText>
                    <AppText className="text-base text-slate">
                      {formatIntentAmount(
                        selectedIntent.settledAmount ?? selectedIntent.requestedAmount,
                        selectedIntent.asset.symbol,
                        selectedIntent.intentType,
                        locale,
                        selectedIntent.transferDirection
                      )}
                    </AppText>
                  </View>
                  <StatusChip
                    label={formatIntentStatusLabel(selectedIntent.status, locale)}
                    tone={getIntentStatusTone(selectedIntent.status)}
                  />
                </View>
                <SectionCard className="gap-2">
                  <AppText className="text-sm text-slate">
                    {t("transactions.internalReference")}
                  </AppText>
                  <LtrValue value={selectedIntent.id} className="text-sm text-ink" />
                  <AppText className="mt-2 text-sm text-slate">
                    {t("transactions.address")}
                  </AppText>
                  <LtrValue
                    value={resolveIntentAddress(selectedIntent)}
                    className="text-sm text-ink"
                  />
                  {selectedIntent.latestBlockchainTransaction?.txHash ? (
                    <>
                      <AppText className="mt-2 text-sm text-slate">
                        {t("transactions.chainHash")}
                      </AppText>
                      <LtrValue
                        value={selectedIntent.latestBlockchainTransaction.txHash}
                        className="text-sm text-ink"
                      />
                    </>
                  ) : null}
                </SectionCard>
                <SectionCard>
                  <TimelineList events={buildIntentTimeline(selectedIntent)} />
                </SectionCard>
                <AppButton
                  label={t("common.close")}
                  onPress={() => setSelectedIntent(null)}
                  variant="secondary"
                />
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </AppScreen>
  );
}
