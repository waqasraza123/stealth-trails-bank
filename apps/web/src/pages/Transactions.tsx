import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { TransactionFilter } from "@/components/transactions/TransactionFilter";
import {
  useMyTransactionHistory,
  type TransactionHistoryIntent,
} from "@/hooks/transactions/useMyTransactionHistory";
import {
  formatDateLabel,
  formatIntentAmount,
  getIntentStatusBadgeTone,
  normalizeIntentTypeLabel,
  resolveIntentAddress
} from "@/lib/customer-finance";

type TransactionFilters = {
  search: string;
  types: string[];
  statuses: string[];
  dateRange: { from: Date | undefined; to: Date | undefined };
};

type TransactionRow = {
  id: string;
  type: string;
  amount: string;
  date: string;
  status: string;
  address: string;
  assetSymbol: string;
  rawDate: Date;
};

const emptyFilters: TransactionFilters = {
  search: "",
  types: [],
  statuses: [],
  dateRange: {
    from: undefined,
    to: undefined,
  },
};

function mapHistoryToRows(
  intents: TransactionHistoryIntent[] | undefined
): TransactionRow[] {
  if (!intents) {
    return [];
  }

  return intents.map((intent) => ({
    id: intent.id,
    type: normalizeIntentTypeLabel(intent.intentType),
    amount: formatIntentAmount(
      intent.settledAmount ?? intent.requestedAmount,
      intent.asset.symbol,
      intent.intentType
    ),
    date: formatDateLabel(intent.createdAt),
    rawDate: new Date(intent.createdAt),
    status: intent.status,
    address: resolveIntentAddress(intent),
    assetSymbol: intent.asset.symbol,
  }));
}

const Transactions = () => {
  const [filters, setFilters] = useState<TransactionFilters>(emptyFilters);
  const historyQuery = useMyTransactionHistory(100);
  const allTransactions = mapHistoryToRows(historyQuery.data?.intents);

  let filteredTransactions = allTransactions;

  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    filteredTransactions = filteredTransactions.filter(
      (tx) =>
        tx.type.toLowerCase().includes(searchLower) ||
        tx.amount.toLowerCase().includes(searchLower) ||
        tx.address.toLowerCase().includes(searchLower) ||
        tx.assetSymbol.toLowerCase().includes(searchLower)
    );
  }

  if (filters.types.length > 0) {
    filteredTransactions = filteredTransactions.filter((tx) =>
      filters.types.includes(tx.type)
    );
  }

  if (filters.statuses.length > 0) {
    filteredTransactions = filteredTransactions.filter((tx) =>
      filters.statuses.includes(tx.status)
    );
  }

  if (filters.dateRange.from || filters.dateRange.to) {
    filteredTransactions = filteredTransactions.filter((tx) => {
      if (filters.dateRange.from && filters.dateRange.to) {
        return (
          tx.rawDate >= filters.dateRange.from &&
          tx.rawDate <= filters.dateRange.to
        );
      }

      if (filters.dateRange.from) {
        return tx.rawDate >= filters.dateRange.from;
      }

      if (filters.dateRange.to) {
        return tx.rawDate <= filters.dateRange.to;
      }

      return true;
    });
  }

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold text-foreground">Transactions</h1>
        
        <Card className="p-4 glass-card">
          <TransactionFilter
            onFilterChange={setFilters}
            typeOptions={["Deposit", "Withdrawal"]}
            statusOptions={[
              "requested",
              "review_required",
              "approved",
              "queued",
              "broadcast",
              "confirmed",
              "settled",
              "failed",
              "cancelled",
              "manually_resolved",
            ]}
          />
        </Card>

        <Card className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Type</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Amount</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Date</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Address</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {historyQuery.isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                      Loading transaction history...
                    </td>
                  </tr>
                ) : historyQuery.isError ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-destructive">
                      {historyQuery.error instanceof Error
                        ? historyQuery.error.message
                        : "Failed to load transaction history."}
                    </td>
                  </tr>
                ) : filteredTransactions.length > 0 ? (
                  filteredTransactions.map((tx) => (
                    <tr key={tx.id} className="border-b last:border-0 hover:bg-mint-50/50">
                      <td className="px-6 py-4">{tx.type}</td>
                      <td className={`px-6 py-4 ${
                        tx.amount.startsWith("+") ? "text-mint-600" : "text-destructive"
                      }`}>
                        {tx.amount}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{tx.date}</td>
                      <td className="px-6 py-4 font-mono text-sm">{tx.address}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getIntentStatusBadgeTone(
                            tx.status
                          )}`}
                        >
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                      No transactions found matching your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
        
        {filteredTransactions.length > 0 && (
          <div className="text-sm text-muted-foreground text-right">
            Showing {filteredTransactions.length} of {allTransactions.length} transactions
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Transactions;
