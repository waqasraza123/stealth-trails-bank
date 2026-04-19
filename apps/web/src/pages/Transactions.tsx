import { useMemo, useState } from "react";
import { Filter, Search } from "lucide-react";
import { Layout } from "@/components/Layout";
import {
  FilterReveal,
  MotionSurface,
  ScreenTransition
} from "@/components/motion/primitives";
import { TimelineList } from "@/components/customer/TimelineList";
import { StatusBadge } from "@/components/customer/StatusBadge";
import { Card } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";
import { useLocale } from "@/i18n/use-locale";
import { useT } from "@/i18n/use-t";
import {
  useMyTransactionHistory,
  type TransactionHistoryIntent
} from "@/hooks/transactions/useMyTransactionHistory";
import {
  buildIntentTimeline,
  formatDateLabel,
  formatIntentAmount,
  formatIntentStatusLabel,
  getIntentConfidenceStatus,
  normalizeIntentTypeLabel,
  resolveIntentAddress
} from "@/lib/customer-finance";
import { getTransactionConfidenceTone } from "@stealth-trails-bank/ui-foundation";

type TransactionFilters = {
  search: string;
  type: string;
  status: string;
};

type TransactionRow = {
  id: string;
  type: string;
  amount: string;
  date: string;
  statusLabel: string;
  statusTone: "neutral" | "positive" | "warning" | "critical" | "technical";
  address: string;
  assetSymbol: string;
  raw: TransactionHistoryIntent;
};

const emptyFilters: TransactionFilters = {
  search: "",
  type: "",
  status: ""
};

function mapHistoryToRows(
  intents: TransactionHistoryIntent[] | undefined,
  locale: "en" | "ar"
): TransactionRow[] {
  if (!intents) {
    return [];
  }

  return intents.map((intent) => {
    const confidence = getIntentConfidenceStatus(intent.status);

    return {
      id: intent.id,
      type: normalizeIntentTypeLabel(intent.intentType, locale),
      amount: formatIntentAmount(
        intent.settledAmount ?? intent.requestedAmount,
        intent.asset.symbol,
        intent.intentType,
        locale
      ),
      date: formatDateLabel(intent.createdAt, locale),
      statusLabel: formatIntentStatusLabel(intent.status, locale),
      statusTone: getTransactionConfidenceTone(confidence),
      address: resolveIntentAddress(intent),
      assetSymbol: intent.asset.symbol,
      raw: intent
    };
  });
}

const Transactions = () => {
  const t = useT();
  const { locale } = useLocale();
  const [filters, setFilters] = useState<TransactionFilters>(emptyFilters);
  const [selectedRow, setSelectedRow] = useState<TransactionRow | null>(null);
  const historyQuery = useMyTransactionHistory(100);
  const allTransactions = useMemo(
    () => mapHistoryToRows(historyQuery.data?.intents, locale),
    [historyQuery.data?.intents, locale]
  );

  const typeOptions = useMemo(
    () => Array.from(new Set(allTransactions.map((item) => item.type))),
    [allTransactions]
  );
  const statusOptions = useMemo(
    () => Array.from(new Set(allTransactions.map((item) => item.statusLabel))),
    [allTransactions]
  );

  const filteredTransactions = allTransactions.filter((tx) => {
    const searchLower = filters.search.trim().toLowerCase();

    const matchesSearch =
      searchLower.length === 0 ||
      tx.type.toLowerCase().includes(searchLower) ||
      tx.amount.toLowerCase().includes(searchLower) ||
      tx.address.toLowerCase().includes(searchLower) ||
      tx.assetSymbol.toLowerCase().includes(searchLower) ||
      tx.id.toLowerCase().includes(searchLower);

    const matchesType = !filters.type || tx.type === filters.type;
    const matchesStatus = !filters.status || tx.statusLabel === filters.status;

    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <Layout>
      <ScreenTransition className="stb-page-stack">
        <MotionSurface className="stb-pressable-shell">
          <Card className="stb-surface stb-reveal rounded-[2rem] border-0 p-6">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_440px] xl:items-end">
            <div>
              <p className="stb-section-kicker">{t("transactions.title")}</p>
              <h1 className="stb-page-title mt-2 text-3xl font-semibold text-slate-950">
                {locale === "ar" ? "سجل حركة الأموال" : "Money movement history"}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                {locale === "ar"
                  ? "اعرض الحالة الحالية، وتحقق من المراجع، وافتح الخط الزمني الكامل لكل طلب عند الحاجة."
                  : "Review the current state, verify references, and open the full timeline for any request when needed."}
              </p>
            </div>
            <FilterReveal className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px_180px]">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  className="stb-premium-input pl-11 pr-4"
                  placeholder={locale === "ar" ? "ابحث بالمرجع أو العنوان..." : "Search by reference or address..."}
                  value={filters.search}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, search: event.target.value }))
                  }
                />
              </label>
              <select
                className="stb-premium-input"
                value={filters.type}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, type: event.target.value }))
                }
              >
                <option value="">{locale === "ar" ? "كل الأنواع" : "All types"}</option>
                {typeOptions.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <select
                className="stb-premium-input"
                value={filters.status}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, status: event.target.value }))
                }
              >
                <option value="">{locale === "ar" ? "كل الحالات" : "All statuses"}</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </FilterReveal>
          </div>
          </Card>
        </MotionSurface>

        <MotionSurface className="stb-pressable-shell">
          <Card className="stb-surface stb-reveal rounded-[2rem] border-0 p-3 sm:p-4" data-delay="1">
          <div className="overflow-x-auto">
            <div className="stb-premium-table">
              <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {t("transactions.table.type")}
                  </th>
                  <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {t("transactions.table.amount")}
                  </th>
                  <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {t("transactions.table.date")}
                  </th>
                  <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {t("transactions.table.address")}
                  </th>
                  <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {t("transactions.table.status")}
                  </th>
                  <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {locale === "ar" ? "تفاصيل" : "Details"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {historyQuery.isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                      {t("transactions.loading")}
                    </td>
                  </tr>
                ) : historyQuery.isError ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-red-700">
                      {historyQuery.error instanceof Error
                        ? historyQuery.error.message
                        : t("transactions.loadError")}
                    </td>
                  </tr>
                ) : filteredTransactions.length > 0 ? (
                  filteredTransactions.map((tx) => (
                    <tr
                      key={tx.id}
                      className="stb-premium-row border-b border-slate-100 last:border-0"
                    >
                      <td className="px-4 py-4 text-sm font-semibold text-slate-950">
                        {tx.type}
                      </td>
                      <td className="px-4 py-4 text-sm font-medium text-slate-900">
                        {tx.amount}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-500">{tx.date}</td>
                      <td className="px-4 py-4 text-sm text-slate-600">
                        <span className="stb-ref">
                          <bdi>{tx.address}</bdi>
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge label={tx.statusLabel} tone={tx.statusTone} />
                      </td>
                      <td className="px-4 py-4">
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/88 px-4 py-2 text-sm font-semibold text-slate-900 shadow-[0_10px_22px_rgba(10,18,28,0.05)] transition-[background-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_14px_28px_rgba(10,18,28,0.08)]"
                          onClick={() => setSelectedRow(tx)}
                        >
                          <Filter className="h-4 w-4" />
                          {locale === "ar" ? "فتح" : "Open"}
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                      {t("transactions.empty")}
                    </td>
                  </tr>
                )}
              </tbody>
              </table>
            </div>
          </div>
          </Card>
        </MotionSurface>

        {filteredTransactions.length > 0 ? (
          <p className="text-right text-sm text-slate-500">
            {t("transactions.showingCount", {
              shown: String(filteredTransactions.length),
              total: String(allTransactions.length)
            })}
          </p>
        ) : null}

        <Sheet open={Boolean(selectedRow)} onOpenChange={(open) => !open && setSelectedRow(null)}>
          <SheetContent side="right" className="stb-sheet-panel w-full max-w-2xl overflow-y-auto border-slate-200 sm:max-w-2xl">
            {selectedRow ? (
              <>
                <SheetHeader className="border-b border-slate-200 pb-5 text-left">
                  <SheetTitle className="text-2xl text-slate-950">
                    {selectedRow.type}
                  </SheetTitle>
                  <SheetDescription className="text-sm leading-7 text-slate-600">
                    {locale === "ar"
                      ? "تتبع الحالة الحالية، ومرجع الطلب، وبيانات التنفيذ التقنية عند توفرها."
                      : "Track the current state, request reference, and technical execution detail when available."}
                  </SheetDescription>
                </SheetHeader>

                <div className="mt-6 space-y-6">
                  <Card className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-none">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">
                          {selectedRow.amount}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          {locale === "ar" ? "تم الإنشاء" : "Created"} {selectedRow.date}
                        </p>
                      </div>
                      <StatusBadge label={selectedRow.statusLabel} tone={selectedRow.statusTone} />
                    </div>
                    <div className="mt-5 grid gap-3 text-sm text-slate-600">
                      <div className="flex justify-between gap-3">
                        <span>{locale === "ar" ? "المرجع الداخلي" : "Internal reference"}</span>
                        <span className="stb-ref font-semibold text-slate-950">
                          {selectedRow.raw.id}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span>{locale === "ar" ? "العنوان" : "Address"}</span>
                        <span className="stb-ref font-semibold text-slate-950">
                          <bdi>{selectedRow.address}</bdi>
                        </span>
                      </div>
                      {selectedRow.raw.latestBlockchainTransaction?.txHash ? (
                        <div className="flex justify-between gap-3">
                          <span>{locale === "ar" ? "هاش السلسلة" : "Chain hash"}</span>
                          <span className="stb-ref font-semibold text-slate-950">
                            {selectedRow.raw.latestBlockchainTransaction.txHash}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </Card>

                  <Card className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-none">
                    <h3 className="text-lg font-semibold text-slate-950">
                      {locale === "ar" ? "الخط الزمني" : "Timeline"}
                    </h3>
                    <div className="mt-5">
                      <TimelineList events={buildIntentTimeline(selectedRow.raw)} />
                    </div>
                  </Card>
                </div>
              </>
            ) : null}
          </SheetContent>
        </Sheet>
      </ScreenTransition>
    </Layout>
  );
};

export default Transactions;
