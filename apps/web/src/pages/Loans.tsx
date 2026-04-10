import { useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/Layout";
import { StatusBadge } from "@/components/customer/StatusBadge";
import { TimelineList } from "@/components/customer/TimelineList";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLocale } from "@/i18n/use-locale";
import { formatDateLabel, formatTokenAmount } from "@/lib/customer-finance";
import { useCreateLoanApplication, useLoansDashboard, usePreviewLoanQuote, useSetLoanAutopay } from "@/hooks/loans/useLoans";
import { AlertTriangle, BadgeDollarSign, Landmark, Scale, ShieldCheck } from "lucide-react";

function mapLoanTone(status: string): "neutral" | "positive" | "warning" | "critical" | "technical" {
  if (status.includes("reject") || status.includes("default") || status.includes("fail")) {
    return "critical";
  }

  if (status.includes("grace") || status.includes("delinquent") || status.includes("review")) {
    return "warning";
  }

  if (status.includes("active") || status.includes("closed") || status.includes("approved")) {
    return "positive";
  }

  if (status.includes("fund")) {
    return "technical";
  }

  return "neutral";
}

const EMPTY_SUPPORT_NOTE = "";

const Loans = () => {
  const { locale } = useLocale();
  const dashboardQuery = useLoansDashboard();
  const previewQuoteMutation = usePreviewLoanQuote();
  const createApplicationMutation = useCreateLoanApplication();
  const setAutopayMutation = useSetLoanAutopay();

  const [jurisdiction, setJurisdiction] = useState<"saudi_arabia" | "uae" | "usa">("usa");
  const [borrowAssetSymbol, setBorrowAssetSymbol] = useState<"ETH" | "USDC">("USDC");
  const [collateralAssetSymbol, setCollateralAssetSymbol] = useState<"ETH" | "USDC">("ETH");
  const [borrowAmount, setBorrowAmount] = useState("1000");
  const [collateralAmount, setCollateralAmount] = useState("1600");
  const [termMonths, setTermMonths] = useState("6");
  const [autopayEnabled, setAutopayEnabled] = useState(true);
  const [supportNote, setSupportNote] = useState(EMPTY_SUPPORT_NOTE);
  const [acknowledged, setAcknowledged] = useState(false);
  const [selectedAgreementId, setSelectedAgreementId] = useState<string | null>(null);

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

  const selectedPolicy = useMemo(
    () => dashboard?.policyPacks.find((pack) => pack.jurisdiction === jurisdiction) ?? null,
    [dashboard?.policyPacks, jurisdiction]
  );

  const inlineError =
    (dashboardQuery.error instanceof Error && dashboardQuery.error.message) ||
    (previewQuoteMutation.error instanceof Error && previewQuoteMutation.error.message) ||
    (createApplicationMutation.error instanceof Error &&
      createApplicationMutation.error.message) ||
    (setAutopayMutation.error instanceof Error && setAutopayMutation.error.message) ||
    null;

  const canPreview =
    borrowAmount.trim().length > 0 &&
    collateralAmount.trim().length > 0 &&
    termMonths.trim().length > 0;

  const canSubmit = canPreview && acknowledged && Boolean(previewQuoteMutation.data);

  async function handlePreviewQuote() {
    await previewQuoteMutation.mutateAsync({
      jurisdiction,
      borrowAssetSymbol,
      collateralAssetSymbol,
      borrowAmount,
      collateralAmount,
      termMonths,
      autopayEnabled
    });
  }

  async function handleSubmitApplication() {
    await createApplicationMutation.mutateAsync({
      jurisdiction,
      borrowAssetSymbol,
      collateralAssetSymbol,
      borrowAmount,
      collateralAmount,
      termMonths,
      autopayEnabled,
      disclosureAcknowledgement:
        locale === "ar"
          ? "أقر بأن رسوم الخدمة ثابتة وتم شرحها لي."
          : "I acknowledge that the disclosed service fee is fixed and non-interest bearing.",
      acceptServiceFeeDisclosure: acknowledged,
      supportNote: supportNote.trim() || undefined
    });
    setAcknowledged(false);
    setSupportNote(EMPTY_SUPPORT_NOTE);
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">
            {locale === "ar" ? "قروض مُدارة" : "Managed lending"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {locale === "ar"
              ? "تدفق قرض إنتاجي للعملاء الحقيقيين مع مراجعة تشغيلية، رسوم خدمة ثابتة، وجدولة سداد واضحة."
              : "A production lending surface for real customers, with governed origination, fixed service fees, and explicit servicing states."}
          </p>
        </div>

        {dashboard?.eligibility && !dashboard.eligibility.eligible ? (
          <Alert className="border-amber-200 bg-amber-50">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>
              {locale === "ar" ? "الإقراض غير متاح بعد" : "Lending is not available yet"}
            </AlertTitle>
            <AlertDescription>
              {dashboard.eligibility.reasons.join(" ")}
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="border-emerald-200 bg-emerald-50">
            <ShieldCheck className="h-4 w-4" />
            <AlertTitle>
              {locale === "ar" ? "الحساب مؤهل للإقراض المُدار" : "Account is eligible for managed lending"}
            </AlertTitle>
            <AlertDescription>
              {locale === "ar"
                ? "يمكنك طلب قرض بعملة ETH أو USDC مع ضمان ETH أو USDC. كل طلب يمر بمراجعة تشغيلية قبل التفعيل."
                : "You can request ETH or USDC borrowing against ETH or USDC collateral. Every request goes through operator review before activation."}
            </AlertDescription>
          </Alert>
        )}

        {inlineError ? (
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{locale === "ar" ? "تعذر إكمال العملية" : "Request could not be completed"}</AlertTitle>
            <AlertDescription>{inlineError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BadgeDollarSign className="h-5 w-5 text-mint-600" />
                {locale === "ar" ? "سعة الاقتراض" : "Borrowing capacity"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="rounded-xl border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">ETH</p>
                <p className="mt-2 text-xl font-semibold text-foreground">
                  {formatTokenAmount(dashboard?.eligibility.borrowingCapacity.ETH ?? "0", locale)} ETH
                </p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">USDC</p>
                <p className="mt-2 text-xl font-semibold text-foreground">
                  {formatTokenAmount(dashboard?.eligibility.borrowingCapacity.USDC ?? "0", locale)} USDC
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-mint-600" />
                {locale === "ar" ? "محافظ السياسة" : "Policy packs"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {dashboard?.policyPacks.map((pack) => (
                <div key={pack.jurisdiction} className="rounded-xl border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-foreground">{pack.displayName}</strong>
                    <span className="text-xs text-muted-foreground">
                      {locale === "ar"
                        ? `${pack.gracePeriodDays} أيام سماح`
                        : `${pack.gracePeriodDays}-day grace`}
                    </span>
                  </div>
                  <p className="mt-2 text-muted-foreground">{pack.disclosureBody}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Landmark className="h-5 w-5 text-mint-600" />
                {locale === "ar" ? "طلبات معلّقة" : "Pending applications"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {dashboard?.applications.length ? (
                dashboard.applications.slice(0, 3).map((application) => (
                  <div key={application.id} className="rounded-xl border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <strong className="text-foreground">
                        {formatTokenAmount(application.requestedBorrowAmount, locale)} {application.borrowAsset.symbol}
                      </strong>
                      <StatusBadge
                        label={application.status.replace(/_/g, " ")}
                        tone={mapLoanTone(application.status)}
                      />
                    </div>
                    <p className="mt-2 text-muted-foreground">
                      {application.collateralAsset.symbol} {formatTokenAmount(application.requestedCollateralAmount, locale)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">
                  {locale === "ar" ? "لا توجد طلبات بعد." : "No applications yet."}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-mint-600" />
                {locale === "ar" ? "القروض النشطة" : "Active loans"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-xl border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {locale === "ar" ? "إجمالي العقود" : "Total agreements"}
                </p>
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  {dashboard?.agreements.length ?? 0}
                </p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {locale === "ar" ? "العقد المحدد" : "Selected agreement"}
                </p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {selectedAgreement?.id ?? (locale === "ar" ? "غير متاح" : "Not available")}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>{locale === "ar" ? "طلب قرض جديد" : "New loan application"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    {locale === "ar" ? "البلد / السياسة" : "Jurisdiction"}
                  </label>
                  <select
                    className="flex h-12 w-full rounded-2xl border border-input bg-white px-4 py-2 text-sm"
                    value={jurisdiction}
                    onChange={(event) =>
                      setJurisdiction(event.target.value as "saudi_arabia" | "uae" | "usa")
                    }
                  >
                    {dashboard?.policyPacks.map((pack) => (
                      <option key={pack.jurisdiction} value={pack.jurisdiction}>
                        {pack.displayName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    {locale === "ar" ? "مدة القرض (بالأشهر)" : "Term (months)"}
                  </label>
                  <Input value={termMonths} onChange={(event) => setTermMonths(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    {locale === "ar" ? "أصل القرض" : "Borrow asset"}
                  </label>
                  <select
                    className="flex h-12 w-full rounded-2xl border border-input bg-white px-4 py-2 text-sm"
                    value={borrowAssetSymbol}
                    onChange={(event) => setBorrowAssetSymbol(event.target.value as "ETH" | "USDC")}
                  >
                    {dashboard?.supportedBorrowAssets.map((asset) => (
                      <option key={asset} value={asset}>
                        {asset}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    {locale === "ar" ? "أصل الضمان" : "Collateral asset"}
                  </label>
                  <select
                    className="flex h-12 w-full rounded-2xl border border-input bg-white px-4 py-2 text-sm"
                    value={collateralAssetSymbol}
                    onChange={(event) =>
                      setCollateralAssetSymbol(event.target.value as "ETH" | "USDC")
                    }
                  >
                    {dashboard?.supportedCollateralAssets.map((asset) => (
                      <option key={asset} value={asset}>
                        {asset}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    {locale === "ar" ? "مبلغ القرض" : "Borrow amount"}
                  </label>
                  <Input value={borrowAmount} onChange={(event) => setBorrowAmount(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    {locale === "ar" ? "مبلغ الضمان" : "Collateral amount"}
                  </label>
                  <Input
                    value={collateralAmount}
                    onChange={(event) => setCollateralAmount(event.target.value)}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">
                  {selectedPolicy?.displayName ?? (locale === "ar" ? "سياسة القرض" : "Lending policy")}
                </p>
                <p className="mt-2">
                  {selectedPolicy?.disclosureBody ??
                    (locale === "ar"
                      ? "سيتم عرض الإفصاح الخاص بالسياسة بعد اختيار البلد."
                      : "The jurisdiction-specific disclosure appears once you select a policy pack.")}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {locale === "ar" ? "ملاحظة للدعم أو المراجعة" : "Support or review note"}
                </label>
                <Textarea
                  value={supportNote}
                  onChange={(event) => setSupportNote(event.target.value)}
                  placeholder={
                    locale === "ar"
                      ? "اكتب أي سياق يساعد فريق المراجعة."
                      : "Add any context that helps the operator review team."
                  }
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-3 text-sm text-foreground">
                  <Checkbox
                    checked={autopayEnabled}
                    onCheckedChange={(value) => setAutopayEnabled(Boolean(value))}
                  />
                  <span>
                    {locale === "ar"
                      ? "تفعيل التحصيل التلقائي من الرصيد المُدار"
                      : "Enable autopay from managed balances"}
                  </span>
                </label>
                <label className="flex items-center gap-3 text-sm text-foreground">
                  <Checkbox checked={acknowledged} onCheckedChange={(value) => setAcknowledged(Boolean(value))} />
                  <span>
                    {locale === "ar"
                      ? "أقر برسوم الخدمة الثابتة وأن القرض غير ربحي"
                      : "I accept the disclosed fixed service fee and non-interest structure"}
                  </span>
                </label>
              </div>

              {previewQuoteMutation.data ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        {locale === "ar" ? "إجمالي السداد" : "Total repayable"}
                      </p>
                      <p className="mt-2 text-lg font-semibold text-foreground">
                        {formatTokenAmount(previewQuoteMutation.data.totalRepayableAmount, locale)} {borrowAssetSymbol}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        {locale === "ar" ? "القسط" : "Installment"}
                      </p>
                      <p className="mt-2 text-lg font-semibold text-foreground">
                        {formatTokenAmount(previewQuoteMutation.data.installmentAmount, locale)} {borrowAssetSymbol}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        {locale === "ar" ? "نسبة الضمان" : "Collateral ratio"}
                      </p>
                      <p className="mt-2 text-lg font-semibold text-foreground">
                        {previewQuoteMutation.data.requestedCollateralRatioBps / 100}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        {locale === "ar" ? "رسوم الخدمة" : "Service fee"}
                      </p>
                      <p className="mt-2 text-lg font-semibold text-foreground">
                        {formatTokenAmount(previewQuoteMutation.data.serviceFeeAmount, locale)} {borrowAssetSymbol}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handlePreviewQuote()}
                  disabled={!canPreview || previewQuoteMutation.isPending}
                >
                  {locale === "ar" ? "معاينة العرض" : "Preview quote"}
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleSubmitApplication()}
                  disabled={!canSubmit || createApplicationMutation.isPending}
                >
                  {locale === "ar" ? "إرسال الطلب للمراجعة" : "Submit for review"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle>{locale === "ar" ? "العقد المحدد" : "Selected agreement"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {selectedAgreement ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        {locale === "ar" ? "الحالة" : "Status"}
                      </p>
                      <div className="mt-2">
                        <StatusBadge
                          label={selectedAgreement.status.replace(/_/g, " ")}
                          tone={mapLoanTone(selectedAgreement.status)}
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        void setAutopayMutation.mutateAsync({
                          loanAgreementId: selectedAgreement.id,
                          enabled: !selectedAgreement.autopayEnabled
                        })
                      }
                      disabled={setAutopayMutation.isPending}
                    >
                      {selectedAgreement.autopayEnabled
                        ? locale === "ar"
                          ? "تعطيل التحصيل التلقائي"
                          : "Disable autopay"
                        : locale === "ar"
                          ? "تفعيل التحصيل التلقائي"
                          : "Enable autopay"}
                    </Button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        {locale === "ar" ? "المتبقي" : "Outstanding"}
                      </p>
                      <p className="mt-2 text-xl font-semibold text-foreground">
                        {formatTokenAmount(selectedAgreement.outstandingTotalAmount, locale)}{" "}
                        {selectedAgreement.borrowAsset.symbol}
                      </p>
                    </div>
                    <div className="rounded-xl border p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        {locale === "ar" ? "الاستحقاق التالي" : "Next due"}
                      </p>
                      <p className="mt-2 text-sm font-semibold text-foreground">
                        {selectedAgreement.nextDueAt
                          ? formatDateLabel(selectedAgreement.nextDueAt, locale)
                          : locale === "ar"
                            ? "لا يوجد"
                            : "None"}
                      </p>
                    </div>
                  </div>

                  <Alert className="border-slate-200 bg-slate-50">
                    <ShieldCheck className="h-4 w-4" />
                    <AlertTitle>{locale === "ar" ? "ملاحظة الخدمة" : "Servicing note"}</AlertTitle>
                    <AlertDescription>{selectedAgreement.notice}</AlertDescription>
                  </Alert>

                  <div className="space-y-3">
                    <p className="text-sm font-medium text-foreground">
                      {locale === "ar" ? "الجدول" : "Installment schedule"}
                    </p>
                    {selectedAgreement.installments.slice(0, 4).map((installment) => (
                      <div key={installment.id} className="rounded-xl border p-4">
                        <div className="flex items-center justify-between gap-3">
                          <strong className="text-foreground">
                            {locale === "ar"
                              ? `القسط ${installment.installmentNumber}`
                              : `Installment ${installment.installmentNumber}`}
                          </strong>
                          <StatusBadge
                            label={installment.status.replace(/_/g, " ")}
                            tone={mapLoanTone(installment.status)}
                          />
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {formatDateLabel(installment.dueAt, locale)} ·{" "}
                          {formatTokenAmount(installment.scheduledTotalAmount, locale)}{" "}
                          {selectedAgreement.borrowAsset.symbol}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-medium text-foreground">
                      {locale === "ar" ? "الخط الزمني" : "Timeline"}
                    </p>
                    <TimelineList events={selectedAgreement.timeline} />
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {locale === "ar"
                    ? "سيظهر عقد القرض هنا بعد الموافقة والتمويل."
                    : "Your loan agreement will appear here after approval and funding."}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>{locale === "ar" ? "مسار الطلبات" : "Application tracker"}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            {dashboard?.applications.length ? (
              dashboard.applications.map((application) => (
                <div key={application.id} className="rounded-2xl border border-border/70 bg-white/70 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {formatTokenAmount(application.requestedBorrowAmount, locale)}{" "}
                        {application.borrowAsset.symbol}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {application.collateralAsset.symbol}{" "}
                        {formatTokenAmount(application.requestedCollateralAmount, locale)}
                      </p>
                    </div>
                    <StatusBadge
                      label={application.status.replace(/_/g, " ")}
                      tone={mapLoanTone(application.status)}
                    />
                  </div>
                  <p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">
                    {formatDateLabel(application.submittedAt, locale)}
                  </p>
                  <div className="mt-4">
                    <TimelineList events={application.timeline} />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                {locale === "ar"
                  ? "عندما ترسل أول طلب قرض، سيظهر مساره هنا."
                  : "When you submit your first application, its governed lifecycle will appear here."}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Loans;
