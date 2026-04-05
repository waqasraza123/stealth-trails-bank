import { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface BalanceCardProps {
  title: string;
  amount: string;
  subAmount?: string;
  icon: LucideIcon;
  footer?: string;
  tone?: "positive" | "warning" | "neutral";
}

export const BalanceCard = ({
  title,
  amount,
  subAmount,
  icon: Icon,
  footer,
  tone = "neutral"
}: BalanceCardProps) => {
  return (
    <Card className="gradient-border overflow-hidden group hover:scale-[1.02] transition-all duration-300">
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <h3 className="text-2xl font-semibold bg-gradient-to-r from-defi-purple to-defi-blue bg-clip-text text-transparent">
              {amount}
            </h3>
            {subAmount && (
              <p className="text-sm text-muted-foreground">{subAmount}</p>
            )}
          </div>
          <div className={cn(
            "rounded-full p-3 transition-colors",
            tone === "positive" && "bg-mint-100 text-mint-700",
            tone === "warning" && "bg-orange-100 text-orange-700",
            tone === "neutral" && "bg-slate-100 text-slate-700"
          )}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {footer ? (
          <div className="border-t border-border/70 pt-3 text-sm text-muted-foreground">
            {footer}
          </div>
        ) : null}
      </div>
    </Card>
  );
};
