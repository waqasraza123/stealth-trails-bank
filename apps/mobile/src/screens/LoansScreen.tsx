import { ScrollView, Switch, View } from "react-native";
import { useEffect, useState } from "react";
import { AppScreen } from "../components/ui/AppScreen";
import { AppButton } from "../components/ui/AppButton";
import { AppText } from "../components/ui/AppText";
import { FieldInput } from "../components/ui/FieldInput";
import { InlineNotice } from "../components/ui/InlineNotice";
import { ScreenHeaderActions } from "../components/ui/ScreenHeaderActions";
import { OptionChips } from "../components/ui/OptionChips";
import { SectionCard } from "../components/ui/SectionCard";
import {
  useAutopayMutation,
  useCreateLoanApplicationMutation,
  useLoansDashboardQuery,
  useQuotePreviewMutation
} from "../hooks/use-customer-queries";
import { useScreenFeedback } from "../hooks/use-app-feedback";
import { useLocale } from "../i18n/use-locale";
import { useT } from "../i18n/use-t";
import {
  formatDateLabel,
  formatTokenAmount,
  isPositiveDecimalString,
  isPositiveIntegerString
} from "../lib/finance";

export function LoansScreen() {
  const t = useT();
  const { locale } = useLocale();
  const feedback = useScreenFeedback();
  const dashboardQuery = useLoansDashboardQuery();
  const quotePreviewMutation = useQuotePreviewMutation();
  const applicationMutation = useCreateLoanApplicationMutation();
  const autopayMutation = useAutopayMutation();
  const [jurisdiction, setJurisdiction] = useState<"saudi_arabia" | "uae" | "usa">(
    "usa"
  );
  const [borrowAssetSymbol, setBorrowAssetSymbol] = useState<"ETH" | "USDC">(
    "USDC"
  );
  const [collateralAssetSymbol, setCollateralAssetSymbol] = useState<"ETH" | "USDC">(
    "ETH"
  );
  const [borrowAmount, setBorrowAmount] = useState("1000");
  const [collateralAmount, setCollateralAmount] = useState("1600");
  const [termMonths, setTermMonths] = useState("6");
  const [autopayEnabled, setAutopayEnabled] = useState(true);
  const [supportNote, setSupportNote] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [selectedAgreementId, setSelectedAgreementId] = useState<string>("");
  const dashboard = dashboardQuery.data;
  const selectedAgreement =
    dashboard?.agreements.find((agreement) => agreement.id === selectedAgreementId) ??
    dashboard?.agreements[0] ??
    null;

  useEffect(() => {
    if (!selectedAgreementId && dashboard?.agreements[0]?.id) {
      setSelectedAgreementId(dashboard.agreements[0].id);
    }
  }, [dashboard?.agreements, selectedAgreementId]);

  async function previewQuote() {
    if (!isPositiveDecimalString(borrowAmount)) {
      feedback.warning(t("wallet.amountInvalid"), {
        title: t("loans.quotePreview")
      });
      return;
    }

    if (!isPositiveDecimalString(collateralAmount)) {
      feedback.warning(t("wallet.amountInvalid"), {
        title: t("loans.quotePreview")
      });
      return;
    }

    if (!isPositiveIntegerString(termMonths)) {
      feedback.warning(t("loans.termInvalid"), {
        title: t("loans.quotePreview")
      });
      return;
    }

    try {
      await quotePreviewMutation.mutateAsync({
        autopayEnabled,
        borrowAmount,
        borrowAssetSymbol,
        collateralAmount,
        collateralAssetSymbol,
        jurisdiction,
        termMonths
      });
    } catch (requestError) {
      feedback.errorFrom(requestError, undefined, {
        title: t("loans.quotePreview")
      });
    }
  }

  async function submitApplication() {
    if (!dashboard?.eligibility.eligible) {
      feedback.warning(t("loans.noEligibility"), {
        title: t("loans.submitApplication")
      });
      return;
    }

    if (!acknowledged) {
      feedback.warning(t("loans.acknowledgementRequired"), {
        title: t("loans.submitApplication")
      });
      return;
    }

    if (!isPositiveDecimalString(borrowAmount)) {
      feedback.warning(t("wallet.amountInvalid"), {
        title: t("loans.submitApplication")
      });
      return;
    }

    if (!isPositiveDecimalString(collateralAmount)) {
      feedback.warning(t("wallet.amountInvalid"), {
        title: t("loans.submitApplication")
      });
      return;
    }

    if (!isPositiveIntegerString(termMonths)) {
      feedback.warning(t("loans.termInvalid"), {
        title: t("loans.submitApplication")
      });
      return;
    }

    try {
      await applicationMutation.mutateAsync({
        autopayEnabled,
        borrowAmount,
        borrowAssetSymbol,
        collateralAmount,
        collateralAssetSymbol,
        jurisdiction,
        termMonths,
        disclosureAcknowledgement: t("loans.acknowledgement"),
        acceptServiceFeeDisclosure: acknowledged,
        supportNote: supportNote || undefined
      });
      feedback.success(t("loans.applicationSubmitted"), {
        title: t("loans.submitApplication")
      });
    } catch (requestError) {
      feedback.errorFrom(requestError, undefined, {
        title: t("loans.submitApplication")
      });
    }
  }

  async function updateAutopay(nextValue: boolean) {
    if (!selectedAgreement) {
      return;
    }

    try {
      await autopayMutation.mutateAsync({
        loanAgreementId: selectedAgreement.id,
        enabled: nextValue,
        note: `${t("loans.autopay")}: ${
          nextValue ? t("common.enabled") : t("common.disabled")
        }`
      });
    } catch (requestError) {
      feedback.errorFrom(requestError, undefined, {
        title: t("loans.autopay")
      });
    }
  }

  return (
    <AppScreen
      title={t("loans.title")}
      subtitle={t("loans.description")}
      trailing={<ScreenHeaderActions />}
    >
      {dashboardQuery.isError ? (
        <InlineNotice
          message={
            dashboardQuery.error instanceof Error
              ? dashboardQuery.error.message
              : t("common.notAvailable")
          }
          tone="critical"
        />
      ) : null}

      {dashboard ? (
        <>
          {!dashboard.eligibility.eligible ? (
            <InlineNotice
              message={dashboard.eligibility.reasons.join(" ") || t("loans.noEligibility")}
              tone="warning"
            />
          ) : null}

          <SectionCard className="gap-4">
            <AppText className="text-xl text-ink" weight="bold">
              {t("loans.borrowingCapacity")}
            </AppText>
            <View className="flex-row flex-wrap gap-3">
              <SectionCard className="min-w-[45%] flex-1">
                <AppText className="text-xs text-slate">ETH</AppText>
                <AppText className="mt-2 text-xl text-ink" weight="bold">
                  {formatTokenAmount(
                    dashboard.eligibility.borrowingCapacity.ETH,
                    locale
                  )}{" "}
                  ETH
                </AppText>
              </SectionCard>
              <SectionCard className="min-w-[45%] flex-1">
                <AppText className="text-xs text-slate">USDC</AppText>
                <AppText className="mt-2 text-xl text-ink" weight="bold">
                  {formatTokenAmount(
                    dashboard.eligibility.borrowingCapacity.USDC,
                    locale
                  )}{" "}
                  USDC
                </AppText>
              </SectionCard>
            </View>
          </SectionCard>

          <SectionCard className="gap-4">
            <AppText className="text-xl text-ink" weight="bold">
              {t("loans.policyPacks")}
            </AppText>
            <OptionChips
              onChange={(value) =>
                setJurisdiction(value as "saudi_arabia" | "uae" | "usa")
              }
              options={dashboard.policyPacks.map((pack) => ({
                label: pack.displayName,
                value: pack.jurisdiction
              }))}
              value={jurisdiction}
            />
            <FieldInput
              keyboardType="decimal-pad"
              label={t("loans.borrowAmount")}
              onChangeText={setBorrowAmount}
              value={borrowAmount}
            />
            <FieldInput
              keyboardType="decimal-pad"
              label={t("loans.collateralAmount")}
              onChangeText={setCollateralAmount}
              value={collateralAmount}
            />
            <FieldInput
              keyboardType="number-pad"
              label={t("loans.termMonths")}
              onChangeText={setTermMonths}
              value={termMonths}
            />
            <OptionChips
              onChange={(value) => setBorrowAssetSymbol(value as "ETH" | "USDC")}
              options={dashboard.supportedBorrowAssets.map((value) => ({
                label: value,
                value
              }))}
              value={borrowAssetSymbol}
            />
            <OptionChips
              onChange={(value) =>
                setCollateralAssetSymbol(value as "ETH" | "USDC")
              }
              options={dashboard.supportedCollateralAssets.map((value) => ({
                label: value,
                value
              }))}
              value={collateralAssetSymbol}
            />
            <View className="flex-row items-center justify-between rounded-2xl border border-border bg-white px-4 py-4">
              <AppText className="text-sm text-ink" weight="semibold">
                {t("loans.autopay")}
              </AppText>
              <Switch
                accessibilityLabel={t("loans.autopay")}
                onValueChange={setAutopayEnabled}
                value={autopayEnabled}
              />
            </View>
            <FieldInput
              label={t("loans.supportNote")}
              multiline
              numberOfLines={4}
              onChangeText={setSupportNote}
              value={supportNote}
            />
            <View className="flex-row items-center justify-between rounded-2xl border border-border bg-white px-4 py-4">
              <AppText className="mr-4 flex-1 text-sm leading-6 text-ink">
                {t("loans.acknowledgement")}
              </AppText>
              <Switch
                accessibilityLabel={t("loans.acknowledgement")}
                onValueChange={setAcknowledged}
                value={acknowledged}
              />
            </View>
            <AppButton
              disabled={!dashboard.eligibility.eligible || quotePreviewMutation.isPending}
              label={t("loans.quotePreview")}
              onPress={() => {
                void previewQuote();
              }}
              variant="secondary"
            />
            <AppButton
              disabled={
                !dashboard.eligibility.eligible ||
                !acknowledged ||
                applicationMutation.isPending
              }
              label={t("loans.submitApplication")}
              onPress={() => {
                void submitApplication();
              }}
            />
            {quotePreviewMutation.data ? (
              <SectionCard className="gap-2">
                <AppText className="text-base text-ink" weight="bold">
                  {t("loans.quotePreview")}
                </AppText>
                <AppText className="text-sm text-slate">
                  {t("loans.principal")}:{" "}
                  {formatTokenAmount(quotePreviewMutation.data.principalAmount, locale)}{" "}
                  {quotePreviewMutation.data.borrowAssetSymbol}
                </AppText>
                <AppText className="text-sm text-slate">
                  {t("loans.serviceFee")}:{" "}
                  {formatTokenAmount(quotePreviewMutation.data.serviceFeeAmount, locale)}
                </AppText>
                <AppText className="text-sm text-slate">
                  {t("loans.installmentAmount")}:{" "}
                  {formatTokenAmount(quotePreviewMutation.data.installmentAmount, locale)}
                </AppText>
              </SectionCard>
            ) : null}
          </SectionCard>

          <SectionCard className="gap-4">
            <AppText className="text-xl text-ink" weight="bold">
              {t("loans.activeAgreements")}
            </AppText>
            {dashboard.agreements.length > 0 ? (
              <>
                <OptionChips
                  onChange={setSelectedAgreementId}
                  options={dashboard.agreements.map((agreement) => ({
                    label: agreement.borrowAsset.symbol,
                    value: agreement.id
                  }))}
                  value={selectedAgreementId}
                />
                {selectedAgreement ? (
                  <View className="gap-3">
                    <AppText className="text-sm text-slate">
                      {t("loans.outstandingTotal")}:{" "}
                      {formatTokenAmount(
                        selectedAgreement.outstandingTotalAmount,
                        locale
                      )}{" "}
                      {selectedAgreement.borrowAsset.symbol}
                    </AppText>
                    <AppText className="text-sm text-slate">
                      {t("loans.nextDue")}:{" "}
                      {selectedAgreement.nextDueAt
                        ? formatDateLabel(selectedAgreement.nextDueAt, locale)
                        : t("common.notAvailable")}
                    </AppText>
                    <AppText className="text-sm text-slate">
                      {t("loans.notice")}: {selectedAgreement.notice}
                    </AppText>
                    <View className="flex-row items-center justify-between rounded-2xl border border-border bg-white px-4 py-4">
                      <AppText className="text-sm text-ink" weight="semibold">
                        {t("loans.autopay")}
                      </AppText>
                      <Switch
                        accessibilityLabel={`${t("loans.autopay")} ${selectedAgreement.id}`}
                        onValueChange={(nextValue) => {
                          void updateAutopay(nextValue);
                        }}
                        value={selectedAgreement.autopayEnabled}
                      />
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View className="flex-row gap-3">
                        {selectedAgreement.installments.map((installment) => (
                          <SectionCard
                            key={installment.id}
                            className="w-48 gap-2 bg-white"
                          >
                            <AppText className="text-sm text-ink" weight="semibold">
                              {t("loans.installment")} {installment.installmentNumber}
                            </AppText>
                            <AppText className="text-xs text-slate">
                              {formatDateLabel(installment.dueAt, locale)}
                            </AppText>
                            <AppText className="text-sm text-slate">
                              {formatTokenAmount(
                                installment.scheduledTotalAmount,
                                locale
                              )}{" "}
                              {selectedAgreement.borrowAsset.symbol}
                            </AppText>
                          </SectionCard>
                        ))}
                      </View>
                    </ScrollView>
                  </View>
                ) : null}
              </>
            ) : (
              <AppText className="text-sm text-slate">{t("common.noData")}</AppText>
            )}
          </SectionCard>
        </>
      ) : null}
    </AppScreen>
  );
}
