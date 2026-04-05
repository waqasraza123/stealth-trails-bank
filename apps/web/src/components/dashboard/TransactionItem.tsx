import { getIntentStatusTextTone } from "@/lib/customer-finance";

interface TransactionItemProps {
  id: string;
  type: string;
  amount: string;
  date: string;
  status: string;
  address?: string;
}

export const TransactionItem = ({
  type,
  amount,
  date,
  status,
  address
}: TransactionItemProps) => {
  return (
    <div className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-mint-50/50">
      <div className="space-y-1">
        <p className="font-medium">{type}</p>
        <p className="text-sm text-muted-foreground">{date}</p>
        {address ? (
          <p className="font-mono text-xs text-muted-foreground">{address}</p>
        ) : null}
      </div>
      <div className="text-right">
        <p className="font-medium">{amount}</p>
        <p className={`text-sm ${getIntentStatusTextTone(status)}`}>
          {status}
        </p>
      </div>
    </div>
  );
};
