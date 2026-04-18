import { useQuery } from "@tanstack/react-query";
import { FileKey2, ShieldCheck, ShieldAlert, Fingerprint } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { useLocale } from "@/i18n/use-locale";
import { readApiErrorMessage } from "@/lib/api";
import { getLatestCustomerLiabilityProof } from "@/lib/solvency-api";
import { verifyLiabilityProof } from "@/lib/solvency-proof";

function formatDecimal(value: string, locale: string): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return value;
  }

  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 6
  }).format(numeric);
}

function formatDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

const ProofVerification = () => {
  const { locale } = useLocale();
  const proofQuery = useQuery({
    queryKey: ["customer-liability-proof"],
    queryFn: () => getLatestCustomerLiabilityProof()
  });

  const proofs =
    proofQuery.data?.proofs.map((proof) => ({
      ...proof,
      verification: verifyLiabilityProof({
        payload: proof.payload,
        leafHash: proof.leafHash,
        rootHash: proof.rootHash,
        proof: proof.proof,
        leafIndex: proof.leafIndex
      })
    })) ?? [];

  return (
    <Layout>
      <div className="stb-page-stack">
        <Card className="stb-surface rounded-[2rem] border-0 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <p className="stb-section-kicker">
                {locale === "ar" ? "إثبات العميل" : "Customer proof"}
              </p>
              <h2 className="stb-page-title text-3xl font-semibold text-slate-950">
                {locale === "ar"
                  ? "تحقق من تضمين التزاماتك في لقطة الملاءة"
                  : "Verify your liabilities were included in the solvency snapshot"}
              </h2>
              <p className="max-w-3xl text-sm leading-7 text-slate-600">
                {locale === "ar"
                  ? "يتم تحميل الورقة الخاصة بك، مسار Merkle، وجذر الأصل المنشور. يتم التحقق محلياً من تطابق الورقة والجذر في المتصفح."
                  : "Your liability leaf, Merkle proof path, and published asset root are loaded and verified locally in the browser."}
              </p>
            </div>
          </div>
        </Card>

        {proofQuery.isLoading ? (
          <Card className="stb-surface rounded-[1.8rem] border-0 p-6 text-sm text-slate-600">
            {locale === "ar" ? "جارٍ تحميل إثباتك..." : "Loading your liability proof..."}
          </Card>
        ) : null}

        {proofQuery.isError ? (
          <Card className="stb-surface rounded-[1.8rem] border-0 p-6 text-sm text-red-700">
            {readApiErrorMessage(
              proofQuery.error,
              locale === "ar"
                ? "تعذر تحميل إثبات الالتزام."
                : "Customer liability proof could not be loaded."
            )}
          </Card>
        ) : null}

        {proofQuery.data ? (
          <>
            <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(320px,0.7fr)]">
              <Card className="stb-surface rounded-[1.8rem] border-0 p-6">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <FileKey2 className="h-4 w-4 text-emerald-700" />
                  {locale === "ar" ? "التقرير المرتبط" : "Bound signed report"}
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <Metric
                    label={locale === "ar" ? "معرّف اللقطة" : "Snapshot ID"}
                    value={proofQuery.data.snapshot.id}
                  />
                  <Metric
                    label={locale === "ar" ? "وقت النشر" : "Published"}
                    value={formatDate(proofQuery.data.report.publishedAt, locale)}
                  />
                  <Metric
                    label={locale === "ar" ? "تجزئة التقرير" : "Report hash"}
                    value={proofQuery.data.report.reportHash}
                    mono
                  />
                  <Metric
                    label={locale === "ar" ? "الموقّع" : "Signer"}
                    value={proofQuery.data.report.signerAddress}
                    mono
                  />
                </div>
              </Card>

              <Card className="stb-surface rounded-[1.8rem] border-0 p-6">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Fingerprint className="h-4 w-4 text-emerald-700" />
                  {locale === "ar" ? "نتيجة التحقق" : "Verification result"}
                </div>
                <div className="mt-5 space-y-4">
                  {proofs.length === 0 ? (
                    <div className="rounded-[1.2rem] border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">
                      {locale === "ar"
                        ? "لا توجد أوراق مسؤولية لهذا الحساب في اللقطة الحالية."
                        : "No liability leaves were found for this account in the current snapshot."}
                    </div>
                  ) : (
                    proofs.map((proof) => {
                      const verified =
                        proof.verification.isLeafHashValid &&
                        proof.verification.isRootValid;

                      return (
                        <div
                          key={`${proof.asset.id}:${proof.leafIndex}`}
                          className={`rounded-[1.25rem] border p-4 ${
                            verified
                              ? "border-emerald-200 bg-emerald-50/70"
                              : "border-red-200 bg-red-50/70"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {verified ? (
                              <ShieldCheck className="h-5 w-5 text-emerald-700" />
                            ) : (
                              <ShieldAlert className="h-5 w-5 text-red-700" />
                            )}
                            <div>
                              <p className="text-sm font-semibold text-slate-950">
                                {proof.asset.displayName} ({proof.asset.symbol})
                              </p>
                              <p className="text-sm text-slate-600">
                                {verified
                                  ? locale === "ar"
                                    ? "تم التحقق محلياً من الورقة والجذر."
                                    : "Leaf and Merkle root verified locally."
                                  : locale === "ar"
                                    ? "فشل التحقق المحلي للورقة أو الجذر."
                                    : "Local verification failed for the leaf or root."}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </Card>
            </div>

            <div className="space-y-4">
              {proofs.map((proof) => (
                <Card
                  key={`${proof.asset.id}:${proof.leafIndex}:details`}
                  className="stb-surface rounded-[1.8rem] border-0 p-6"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-slate-950">
                        {proof.asset.displayName} ({proof.asset.symbol})
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">
                        {locale === "ar"
                          ? "ورقة المسؤولية ومسار الإثبات لهذا الأصل."
                          : "Liability leaf and proof path for this asset."}
                      </p>
                    </div>
                    <div className="rounded-[1rem] bg-slate-950 px-3 py-2 text-xs uppercase tracking-[0.14em] text-white">
                      {locale === "ar" ? "ورقة #" : "Leaf #"} {proof.leafIndex}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-4">
                    <Metric
                      label={locale === "ar" ? "المتاح" : "Available"}
                      value={formatDecimal(proof.payload.availableLiabilityAmount, locale)}
                    />
                    <Metric
                      label={locale === "ar" ? "المحجوز" : "Reserved"}
                      value={formatDecimal(proof.payload.reservedLiabilityAmount, locale)}
                    />
                    <Metric
                      label={locale === "ar" ? "الرصيد المعلق" : "Pending credit"}
                      value={formatDecimal(proof.payload.pendingCreditAmount, locale)}
                    />
                    <Metric
                      label={locale === "ar" ? "الإجمالي" : "Total liability"}
                      value={formatDecimal(proof.payload.totalLiabilityAmount, locale)}
                    />
                  </div>

                  <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    <Metric label={locale === "ar" ? "تجزئة الورقة" : "Leaf hash"} value={proof.leafHash} mono />
                    <Metric label={locale === "ar" ? "الجذر المنشور" : "Published root"} value={proof.rootHash} mono />
                    <Metric label={locale === "ar" ? "تجزئة الورقة المحسوبة" : "Computed leaf hash"} value={proof.verification.computedLeafHash} mono />
                    <Metric label={locale === "ar" ? "الجذر المحسوب" : "Computed root"} value={proof.verification.computedRootHash} mono />
                  </div>

                  <div className="mt-5 rounded-[1.25rem] bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">
                      {locale === "ar" ? "مسار Merkle" : "Merkle proof path"}
                    </p>
                    <div className="mt-3 space-y-2">
                      {proof.proof.length === 0 ? (
                        <p className="text-sm text-slate-500">
                          {locale === "ar"
                            ? "هذه الورقة تمثل الجذر مباشرة."
                            : "This leaf is the root directly."}
                        </p>
                      ) : (
                        proof.proof.map((segment, index) => (
                          <div
                            key={`${segment}:${index}`}
                            className="break-all rounded-[1rem] bg-white px-3 py-2 font-mono text-[0.78rem] text-slate-800"
                          >
                            [{index}] {segment}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </Layout>
  );
};

function Metric({
  label,
  value,
  mono = false
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-[1.2rem] bg-white/80 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className={`mt-2 text-sm font-semibold text-slate-950 ${mono ? "break-all font-mono text-[0.78rem]" : "text-lg"}`}>
        {value}
      </p>
    </div>
  );
}

export default ProofVerification;
