import { useRef, useState } from "react";
import { Copy, QrCode, ShieldCheck } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingButton } from "@/components/ui/loading-button";
import { toast } from "@/components/ui/use-toast";
import { TimelineList } from "@/components/customer/TimelineList";
import { StatusBadge } from "@/components/customer/StatusBadge";
import { SupportedAsset } from "@/hooks/assets/useSupportedAssets";
import {
  CreateDepositIntentResult,
  useCreateDepositIntent
} from "@/hooks/transaction-intents/useCreateDepositIntent";
import {
  buildIntentTimeline,
  buildRequestIdempotencyKey,
  formatDateLabel,
  formatIntentStatusLabel,
  formatTokenAmount,
  getIntentConfidenceStatus,
  isPositiveDecimalString
} from "@/lib/customer-finance";
import { useLocale } from "@/i18n/use-locale";
import { readApiErrorMessage } from "@/lib/api";
import { QRCodeSVG } from "qrcode.react";
import { getTransactionConfidenceTone } from "@stealth-trails-bank/ui-foundation";

type DepositCardProps = {
  walletAddress: string | null;
  assets: SupportedAsset[];
  isAssetsLoading: boolean;
  assetsErrorMessage: string | null;
};

const DepositCard = ({
  walletAddress,
  assets,
  isAssetsLoading,
  assetsErrorMessage
}: DepositCardProps) => {
  const { locale } = useLocale();
  const createDepositIntent = useCreateDepositIntent();
  const [showQR, setShowQR] = useState(false);
  const [preferredAssetSymbol, setPreferredAssetSymbol] = useState("");
  const [amount, setAmount] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [latestRequest, setLatestRequest] =
    useState<CreateDepositIntentResult | null>(null);
  const lastSubmissionRef = useRef<{
    signature: string;
    idempotencyKey: string;
  } | null>(null);

  const selectedAssetSymbol =
    assets.find((asset) => asset.symbol === preferredAssetSymbol)?.symbol ??
    assets[0]?.symbol ??
    "";

  async function handleCopyAddress() {
    if (!walletAddress) {
      return;
    }

    await navigator.clipboard.writeText(walletAddress);

    toast({
      title: locale === "ar" ? "تم نسخ عنوان الإيداع" : "Deposit address copied",
      description:
        locale === "ar"
          ? "تم نسخ عنوان الإيداع المُدار إلى الحافظة."
          : "The managed deposit address is now in your clipboard."
    });
  }

  function getIdempotencyKey(signature: string): string {
    if (lastSubmissionRef.current?.signature === signature) {
      return lastSubmissionRef.current.idempotencyKey;
    }

    const idempotencyKey = buildRequestIdempotencyKey("deposit_req");
    lastSubmissionRef.current = {
      signature,
      idempotencyKey
    };

    return idempotencyKey;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedAmount = amount.trim();

    if (!walletAddress) {
      setFormError(
        locale === "ar"
          ? "عنوان المحفظة المُدارة غير متاح لهذا الحساب."
          : "Managed wallet address is not available for this account."
      );
      return;
    }

    if (!selectedAssetSymbol) {
      setFormError(
        locale === "ar"
          ? "اختر أصلاً قبل تسجيل الطلب."
          : "Select an asset before recording the request."
      );
      return;
    }

    if (!isPositiveDecimalString(normalizedAmount)) {
      setFormError(
        locale === "ar"
          ? "أدخل مبلغاً موجباً بصيغة عشرية صالحة."
          : "Enter a valid positive decimal amount."
      );
      return;
    }

    setFormError(null);

    const requestSignature = JSON.stringify({
      assetSymbol: selectedAssetSymbol,
      amount: normalizedAmount
    });

    try {
      const result = await createDepositIntent.mutateAsync({
        idempotencyKey: getIdempotencyKey(requestSignature),
        assetSymbol: selectedAssetSymbol,
        amount: normalizedAmount
      });

      setLatestRequest(result);
      setAmount("");
      lastSubmissionRef.current = null;

      toast({
        title:
          locale === "ar"
            ? result.idempotencyReused
              ? "تمت إعادة استخدام طلب الإيداع"
              : "تم تسجيل طلب الإيداع"
            : result.idempotencyReused
              ? "Deposit request reused"
              : "Deposit request recorded",
        description:
          locale === "ar"
            ? "يمكنك الآن تتبع الطلب من سجل المعاملات ومن بطاقة التتبع أدناه."
            : "You can now track the request from transaction history and the tracker below."
      });
    } catch (error) {
      const message = readApiErrorMessage(
        error,
        locale === "ar"
          ? "تعذر إنشاء طلب الإيداع."
          : "Failed to create deposit request."
      );
      setFormError(message);

      toast({
        title: locale === "ar" ? "فشل طلب الإيداع" : "Deposit request failed",
        description: message,
        variant: "destructive"
      });
    }
  }

  const latestConfidence = latestRequest
    ? getIntentConfidenceStatus(latestRequest.intent.status)
    : null;

  return (
    <Card className="stb-surface rounded-[2rem] border-0">
      <CardHeader className="space-y-3">
        <CardTitle className="text-2xl text-slate-950">
          {locale === "ar" ? "الإيداع" : "Deposit"}
        </CardTitle>
        <CardDescription className="max-w-2xl text-sm leading-7 text-slate-600">
          {locale === "ar"
            ? "اختر الأصل، اعرض عنوان الإيداع المُدار، وسجّل نيتك قبل إرسال الأموال حتى تبقى المتابعة واضحة."
            : "Choose the asset, review the managed destination, and record your intent before sending funds so the workflow stays traceable."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-[1.5rem] bg-slate-950 p-5 text-white">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4 text-emerald-300" />
            {locale === "ar" ? "خطوات الإيداع" : "Deposit sequence"}
          </div>
          <div className="mt-4 grid gap-3 text-sm text-white/72 sm:grid-cols-3">
            <div>1. {locale === "ar" ? "اعرض الوجهة" : "Review destination"}</div>
            <div>2. {locale === "ar" ? "أرسل الأموال" : "Send funds"}</div>
            <div>3. {locale === "ar" ? "تتبع الكشف والتسوية" : "Track detection and settlement"}</div>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-slate-200 bg-white/80 p-4">
          <div className="mb-2 text-sm font-medium text-slate-700">
            {locale === "ar" ? "عنوان الإيداع المُدار" : "Managed deposit address"}
          </div>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <code className="stb-ref rounded-xl bg-slate-100 px-3 py-2 text-sm break-all text-slate-900">
              {walletAddress ? walletAddress : locale === "ar" ? "لا يوجد عنوان حتى الآن." : "No managed wallet assigned yet."}
            </code>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!walletAddress}
                onClick={handleCopyAddress}
                className="rounded-full"
              >
                <Copy className="h-4 w-4" />
                {locale === "ar" ? "نسخ" : "Copy"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!walletAddress}
                onClick={() => setShowQR((current) => !current)}
                className="rounded-full"
              >
                <QrCode className="h-4 w-4" />
                {showQR
                  ? locale === "ar"
                    ? "إخفاء الرمز"
                    : "Hide QR"
                  : locale === "ar"
                    ? "إظهار الرمز"
                    : "Show QR"}
              </Button>
            </div>
          </div>

          {showQR && walletAddress ? (
            <div className="mt-4 flex justify-center rounded-[1.3rem] bg-white p-4">
              <QRCodeSVG
                value={walletAddress}
                size={160}
                bgColor="#FFFFFF"
                fgColor="#101828"
                level="H"
              />
            </div>
          ) : null}
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="deposit-asset">
                {locale === "ar" ? "الأصل" : "Asset"}
              </label>
              <select
                id="deposit-asset"
                className="flex h-12 w-full rounded-2xl border border-input bg-white px-4 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                value={selectedAssetSymbol}
                disabled={isAssetsLoading || assets.length === 0}
                onChange={(event) => setPreferredAssetSymbol(event.target.value)}
              >
                {assets.length === 0 ? (
                  <option value="">
                    {isAssetsLoading
                      ? locale === "ar"
                        ? "جاري التحميل..."
                        : "Loading assets..."
                      : locale === "ar"
                        ? "لا توجد أصول مدعومة"
                        : "No supported assets"}
                  </option>
                ) : null}
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.symbol}>
                    {asset.displayName} ({asset.symbol})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="deposit-amount">
                {locale === "ar" ? "المبلغ" : "Amount"}
              </label>
              <Input
                id="deposit-amount"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="1.25"
                className="h-12 rounded-2xl bg-white"
              />
            </div>
          </div>

          <div className="rounded-[1.4rem] bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {locale === "ar"
              ? "سجّل الطلب قبل الإرسال حتى تستطيع المنصة تفسير الأموال الواردة على أنها إيداع متوقع."
              : "Record the request before sending funds so the platform can interpret the incoming transfer as expected deposit activity."}
          </div>

          {assetsErrorMessage ? (
            <div className="rounded-[1.4rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {assetsErrorMessage}
            </div>
          ) : null}

          {formError ? (
            <div className="rounded-[1.4rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {formError}
            </div>
          ) : null}

          <LoadingButton
            type="submit"
            className="h-12 w-full rounded-2xl bg-slate-950 text-sm font-semibold text-white hover:bg-slate-900"
            loading={createDepositIntent.isPending}
          >
            {locale === "ar" ? "تسجيل طلب الإيداع" : "Create deposit request"}
          </LoadingButton>
        </form>

        {latestRequest ? (
          <div className="rounded-[1.6rem] border border-slate-200 bg-white/90 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">
                  {locale === "ar" ? "أحدث طلب إيداع" : "Latest deposit request"}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {formatTokenAmount(latestRequest.intent.requestedAmount, locale)}{" "}
                  {latestRequest.intent.asset.symbol}
                </p>
              </div>
              {latestConfidence ? (
                <StatusBadge
                  label={formatIntentStatusLabel(latestRequest.intent.status, locale)}
                  tone={getTransactionConfidenceTone(latestConfidence)}
                />
              ) : null}
            </div>
            <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
              <p>
                {locale === "ar" ? "المرجع:" : "Reference:"}{" "}
                <span className="stb-ref font-semibold text-slate-950">
                  {latestRequest.intent.id}
                </span>
              </p>
              <p>
                {locale === "ar" ? "تم الإنشاء:" : "Created:"}{" "}
                <span className="font-semibold text-slate-950">
                  {formatDateLabel(latestRequest.intent.createdAt, locale)}
                </span>
              </p>
            </div>
            <div className="mt-5">
              <TimelineList events={buildIntentTimeline(latestRequest.intent)} />
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

export default DepositCard;
