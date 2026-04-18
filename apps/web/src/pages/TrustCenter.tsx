import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, FileCheck2, Scale, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLocale } from "@/i18n/use-locale";
import { listPublicSolvencyReports } from "@/lib/solvency-api";
import { readApiErrorMessage } from "@/lib/api";

function formatDecimal(value: string, locale: string): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return value;
  }

  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 6
  }).format(numeric);
}

function formatDate(value: string | null, locale: string): string {
  if (!value) {
    return locale === "ar" ? "غير متاح" : "Not available";
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function shortenHash(value: string): string {
  return value.length <= 18 ? value : `${value.slice(0, 10)}…${value.slice(-8)}`;
}

const TrustCenter = () => {
  const { locale } = useLocale();
  const [searchParams, setSearchParams] = useSearchParams();
  const reportsQuery = useQuery({
    queryKey: ["public-solvency-reports"],
    queryFn: () => listPublicSolvencyReports(12)
  });

  const entries = reportsQuery.data?.reports ?? [];
  const selectedSnapshotId = searchParams.get("snapshot");
  const selectedEntry = useMemo(() => {
    if (selectedSnapshotId) {
      return entries.find((entry) => entry.snapshot.id === selectedSnapshotId) ?? null;
    }

    return entries[0] ?? null;
  }, [entries, selectedSnapshotId]);

  const payload =
    selectedEntry?.report.canonicalPayload &&
    typeof selectedEntry.report.canonicalPayload === "object"
      ? selectedEntry.report.canonicalPayload
      : null;
  const assetRows = Array.isArray(payload?.assets) ? payload.assets : [];
  const policyState =
    payload && typeof payload.policyState === "object" ? payload.policyState : null;

  return (
    <div className="stb-shell-bg min-h-screen px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-6">
        <Card className="stb-inverse-surface overflow-hidden rounded-[2rem] border-0 px-6 py-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-4xl space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-emerald-300/90">
                {locale === "ar" ? "مركز الثقة العامة" : "Public trust center"}
              </p>
              <h1 className="text-4xl font-semibold tracking-[-0.04em] text-white">
                {locale === "ar"
                  ? "تقارير الملاءة الموقعة وإثبات الالتزامات"
                  : "Signed solvency reports and proof-of-liabilities"}
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-white/72 sm:text-base">
                {locale === "ar"
                  ? "يعرض هذا السطح آخر تقارير الملاءة الموقعة، الجذور الخاصة بالالتزامات لكل أصل، ونظرة واضحة على الفرق بين الالتزامات والاحتياطيات القابلة للاستخدام."
                  : "This surface exposes the latest signed solvency reports, per-asset liability roots, and a clear view of liabilities versus usable reserves."}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild className="rounded-[1rem] bg-white text-slate-950 hover:bg-white/90">
                <Link to="/auth/sign-in">
                  {locale === "ar" ? "تسجيل الدخول للتحقق الشخصي" : "Sign in for personal proof"}
                </Link>
              </Button>
            </div>
          </div>
        </Card>

        {reportsQuery.isLoading ? (
          <Card className="stb-surface rounded-[1.8rem] border-0 p-6 text-sm text-slate-600">
            {locale === "ar" ? "جارٍ تحميل تقارير الملاءة..." : "Loading solvency reports..."}
          </Card>
        ) : null}

        {reportsQuery.isError ? (
          <Card className="stb-surface rounded-[1.8rem] border-0 p-6 text-sm text-red-700">
            {readApiErrorMessage(
              reportsQuery.error,
              locale === "ar"
                ? "تعذر تحميل تقارير الملاءة العامة."
                : "Public solvency reports could not be loaded."
            )}
          </Card>
        ) : null}

        {!reportsQuery.isLoading && !reportsQuery.isError ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(320px,0.78fr)_minmax(0,1.22fr)]">
            <Card className="stb-surface rounded-[1.8rem] border-0 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <FileCheck2 className="h-4 w-4 text-emerald-700" />
                {locale === "ar" ? "سجل التقارير العامة" : "Public report index"}
              </div>
              <div className="mt-4 space-y-3">
                {entries.length === 0 ? (
                  <div className="rounded-[1.2rem] border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">
                    {locale === "ar"
                      ? "لا توجد تقارير عامة منشورة بعد."
                      : "No public reports have been published yet."}
                  </div>
                ) : (
                  entries.map((entry) => {
                    const isSelected = entry.snapshot.id === selectedEntry?.snapshot.id;
                    return (
                      <button
                        key={entry.snapshot.id}
                        className={`w-full rounded-[1.2rem] border px-4 py-4 text-left transition ${
                          isSelected
                            ? "border-slate-900 bg-slate-950 text-white"
                            : "border-slate-200 bg-white/70 text-slate-900 hover:border-slate-300"
                        }`}
                        onClick={() => setSearchParams({ snapshot: entry.snapshot.id })}
                        type="button"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">
                              {locale === "ar" ? "لقطة" : "Snapshot"} {shortenHash(entry.snapshot.id)}
                            </p>
                            <p className={`mt-1 text-xs ${isSelected ? "text-white/70" : "text-slate-500"}`}>
                              {formatDate(entry.report.publishedAt, locale)}
                            </p>
                          </div>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] ${
                              isSelected
                                ? "bg-white/12 text-white"
                                : "bg-emerald-50 text-emerald-800"
                            }`}
                          >
                            {entry.snapshot.status}
                          </span>
                        </div>
                        <div className={`mt-3 grid gap-2 text-xs ${isSelected ? "text-white/82" : "text-slate-600"}`}>
                          <div className="flex items-center justify-between gap-3">
                            <span>{locale === "ar" ? "الالتزامات" : "Liabilities"}</span>
                            <span>{formatDecimal(entry.snapshot.totalLiabilityAmount, locale)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span>{locale === "ar" ? "الاحتياطي القابل للاستخدام" : "Usable reserves"}</span>
                            <span>{formatDecimal(entry.snapshot.totalUsableReserveAmount, locale)}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </Card>

            <div className="space-y-6">
              <Card className="stb-surface rounded-[1.8rem] border-0 p-6">
                {selectedEntry ? (
                  <>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                          {locale === "ar" ? "التقرير المحدد" : "Selected report"}
                        </p>
                        <h2 className="text-2xl font-semibold text-slate-950">
                          {locale === "ar" ? "بيان الملاءة الموقع" : "Signed solvency statement"}
                        </h2>
                        <p className="text-sm text-slate-600">
                          {locale === "ar"
                            ? "يرتبط هذا التقرير بلقطة ملاءة محددة ويمكن التحقق منه عبر المعرّفات والتوقيع والجذور المنشورة."
                            : "This report is bound to a specific solvency snapshot and can be checked through its identifiers, signature, and published roots."}
                        </p>
                      </div>
                      <div className="rounded-[1.2rem] bg-slate-950 px-4 py-3 text-sm text-white">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4 text-emerald-300" />
                          <span>{selectedEntry.report.signatureAlgorithm}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-4 md:grid-cols-4">
                      <Metric label={locale === "ar" ? "الالتزامات الكلية" : "Total liabilities"} value={formatDecimal(selectedEntry.snapshot.totalLiabilityAmount, locale)} />
                      <Metric label={locale === "ar" ? "الاحتياطيات القابلة للاستخدام" : "Usable reserves"} value={formatDecimal(selectedEntry.snapshot.totalUsableReserveAmount, locale)} />
                      <Metric label={locale === "ar" ? "الفرق" : "Reserve delta"} value={formatDecimal(selectedEntry.snapshot.totalReserveDeltaAmount, locale)} />
                      <Metric label={locale === "ar" ? "توقيت النشر" : "Published"} value={formatDate(selectedEntry.report.publishedAt, locale)} />
                    </div>

                    <div className="mt-6 grid gap-4 lg:grid-cols-2">
                      <DetailCard
                        icon={Scale}
                        title={locale === "ar" ? "هوية التقرير" : "Report identity"}
                        rows={[
                          [locale === "ar" ? "معرّف اللقطة" : "Snapshot ID", selectedEntry.snapshot.id],
                          [locale === "ar" ? "تجزئة التقرير" : "Report hash", selectedEntry.report.reportHash],
                          [locale === "ar" ? "توقيع المُوقّع" : "Signer address", selectedEntry.report.signerAddress],
                          [locale === "ar" ? "فحص SHA-256" : "SHA-256 checksum", selectedEntry.report.reportChecksumSha256]
                        ]}
                      />
                      <DetailCard
                        icon={policyState?.manualResumeRequired ? ShieldAlert : ShieldCheck}
                        title={locale === "ar" ? "وضع السياسة" : "Policy posture"}
                        rows={[
                          [locale === "ar" ? "الحالة" : "Status", String(policyState?.status ?? selectedEntry.snapshot.status)],
                          [locale === "ar" ? "مطلوب استئناف يدوي" : "Manual resume required", String(Boolean(policyState?.manualResumeRequired))],
                          [locale === "ar" ? "سبب السياسة" : "Reason code", String(policyState?.reasonCode ?? "none")],
                          [locale === "ar" ? "التقادم" : "Evidence freshness", selectedEntry.snapshot.evidenceFreshness]
                        ]}
                      />
                    </div>
                  </>
                ) : null}
              </Card>

              {selectedEntry ? (
                <Card className="stb-surface rounded-[1.8rem] border-0 p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-semibold text-slate-950">
                        {locale === "ar" ? "جذور الالتزامات لكل أصل" : "Per-asset liability roots"}
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">
                        {locale === "ar"
                          ? "كل أصل يحمل جذر Merkle وعدد الأوراق ومعلومات الفجوة بين الالتزامات والاحتياطيات."
                          : "Each asset carries a Merkle root, leaf count, and the gap between liabilities and reserves."}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 space-y-4">
                    {assetRows.length === 0 ? (
                      <div className="rounded-[1.2rem] border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">
                        {locale === "ar"
                          ? "لا توجد أصول منشورة في هذا التقرير."
                          : "No assets were published in this report."}
                      </div>
                    ) : (
                      assetRows.map((asset) => (
                        <div
                          key={String(asset.assetId)}
                          className="rounded-[1.3rem] border border-slate-200 bg-white/80 p-4"
                        >
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                              <p className="text-base font-semibold text-slate-950">
                                {String(asset.displayName)} ({String(asset.symbol)})
                              </p>
                              <p className="mt-1 text-sm text-slate-500">
                                {locale === "ar" ? "جذر الالتزام" : "Liability root"}:{" "}
                                <span className="font-mono text-[0.8rem] text-slate-700">
                                  {String(asset.liabilityMerkleRoot ?? "none")}
                                </span>
                              </p>
                            </div>
                            <span className="rounded-full bg-slate-950 px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-white">
                              {String(asset.snapshotStatus)}
                            </span>
                          </div>
                          <div className="mt-4 grid gap-3 md:grid-cols-4">
                            <Metric label={locale === "ar" ? "الالتزامات" : "Liabilities"} value={formatDecimal(String(asset.totalLiabilityAmount), locale)} compact />
                            <Metric label={locale === "ar" ? "الاحتياطيات القابلة للاستخدام" : "Usable reserves"} value={formatDecimal(String(asset.usableReserveAmount), locale)} compact />
                            <Metric label={locale === "ar" ? "الفرق" : "Delta"} value={formatDecimal(String(asset.reserveDeltaAmount), locale)} compact />
                            <Metric label={locale === "ar" ? "الأوراق" : "Leaf count"} value={String(asset.liabilityLeafCount)} compact />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

function Metric({
  label,
  value,
  compact = false
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className={`rounded-[1.2rem] ${compact ? "bg-slate-50" : "bg-white/85"} p-4`}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function DetailCard({
  icon: Icon,
  title,
  rows
}: {
  icon: typeof ShieldCheck;
  title: string;
  rows: Array<[string, string]>;
}) {
  return (
    <div className="rounded-[1.4rem] bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <Icon className="h-4 w-4 text-emerald-700" />
        {title}
      </div>
      <div className="mt-4 space-y-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-1 text-sm">
            <span className="text-slate-500">{label}</span>
            <span className="break-all font-mono text-[0.78rem] text-slate-900">
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TrustCenter;
