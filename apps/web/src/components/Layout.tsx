import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, History, Wallet, User, CoinsIcon, CreditCard, Menu } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/stores/userStore";
import { formatShortAddress } from "@/lib/customer-finance";

const navItems = [
  { icon: Home, label: "Dashboard", path: "/" },
  { icon: Wallet, label: "Deposit/Withdraw", path: "/wallet" },
  { icon: CoinsIcon, label: "Staking", path: "/staking" },
  { icon: CreditCard, label: "Loans", path: "/loans" },
  { icon: History, label: "Transactions", path: "/transactions" },
  { icon: User, label: "Profile", path: "/profile" },
];

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const user = useUserStore((state) => state.user);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-defi-light-purple/5">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <nav className={cn(
          "fixed h-screen border-r border-border bg-background/50 backdrop-blur-xl transition-all duration-300",
          isCollapsed ? "w-20" : "w-64"
        )}>
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between p-6">
              {!isCollapsed && <Logo />}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="ml-auto"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex-1 space-y-1 p-4">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "flex items-center space-x-3 rounded-lg px-4 py-3 transition-all duration-200 hover:bg-defi-purple/10",
                      isActive ? "bg-defi-purple text-white" : "text-muted-foreground hover:text-defi-purple",
                      isCollapsed && "justify-center"
                    )}
                  >
                    <Icon className={cn("h-5 w-5", isActive && "text-white")} />
                    {!isCollapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
            <div className="p-4">
              <div className="gradient-border">
                <div className="p-4 space-y-2">
                  {!isCollapsed && (
                    <>
                      <p className="text-sm text-muted-foreground">Managed Wallet</p>
                      <p className="text-xs font-mono truncate">
                        {formatShortAddress(user?.ethereumAddress)}
                      </p>
                    </>
                  )}
                  <div className={cn(
                    "h-2 bg-gradient-to-r from-defi-purple via-defi-blue to-defi-pink rounded-full",
                    isCollapsed ? "w-8" : "w-full"
                  )} />
                </div>
              </div>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className={cn(
          "flex-1 transition-all duration-300",
          isCollapsed ? "pl-20" : "pl-64"
        )}>
          <div className="container mx-auto p-8">
            <div className="animate-in">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
};
