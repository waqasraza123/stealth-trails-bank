import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { TransactionItem } from "./TransactionItem";
import { Button } from "@/components/ui/button";

interface Transaction {
  id: string;
  type: string;
  amount: string;
  date: string;
  status: string;
  address?: string;
}

interface RecentTransactionsProps {
  transactions: Transaction[];
  isLoading?: boolean;
  errorMessage?: string | null;
  emptyMessage?: string;
}

export const RecentTransactions = ({
  transactions,
  isLoading = false,
  errorMessage,
  emptyMessage = "No recent transactions yet."
}: RecentTransactionsProps) => {
  return (
    <Card className="glass-card p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold">Recent Transactions</h2>
        <Button asChild variant="outline" size="sm">
          <Link to="/transactions">View all</Link>
        </Button>
      </div>
      {isLoading ? (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Loading recent transactions...
        </div>
      ) : errorMessage ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : transactions.length === 0 ? (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      ) : (
        <div className="space-y-4">
          {transactions.map((transaction) => (
            <TransactionItem key={transaction.id} {...transaction} />
          ))}
        </div>
      )}
    </Card>
  );
};
