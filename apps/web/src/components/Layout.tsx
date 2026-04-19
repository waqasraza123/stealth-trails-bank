import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Bell,
  CircleHelp,
  Landmark,
  ShieldCheck,
  UserRound,
  Wallet
} from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import {
  HeroItem,
  HeroReveal,
  MotionSurface,
  StaggerGrid,
  StaggerItem
} from "@/components/motion/primitives";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLocale } from "@/i18n/use-locale";
import { useT } from "@/i18n/use-t";
import { useUserStore } from "@/stores/userStore";
import { formatDateLabel, formatShortAddress } from "@/lib/customer-finance";

type LayoutProps = {
  children: React.ReactNode;
};

export const Layout = ({ children }: LayoutProps) => {
  const location = useLocation();
  const { locale } = useLocale();
  const t = useT();
  const user = useUserStore((state) => state.user);

  const navItems = [
    { label: t("navigation.dashboard"), path: "/" },
    { label: t("navigation.wallet"), path: "/wallet" },
    { label: locale === "ar" ? "العائد" : "Yield", path: "/yield" },
    { label: t("navigation.transactions"), path: "/transactions" },
    { label: t("navigation.profile"), path: "/profile" }
  ];

  const currentSection =
    navItems.find((item) => item.path === location.pathname)?.label ??
    (location.pathname === "/loans"
      ? t("navigation.loans")
      : locale === "ar"
        ? "منصة العميل"
        : "Customer workspace");

  return (
    <div className="stb-shell-bg min-h-screen text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-col px-4 pb-8 pt-4 sm:px-6 lg:px-8">
        <header className="stb-inverse-surface stb-reveal relative overflow-hidden rounded-[2.25rem] px-5 py-5 sm:px-6 sm:py-6">
          <div className="stb-grid-lines absolute inset-0 opacity-30" aria-hidden="true" />
          <div className="stb-ambient-orb stb-ambient-orb--emerald absolute left-[-4rem] top-[4rem] h-40 w-40" />
          <div className="stb-ambient-orb stb-ambient-orb--indigo absolute right-[2rem] top-[3rem] h-44 w-44" />
          <div
            aria-hidden="true"
            className="absolute inset-y-0 right-0 w-[34rem] bg-[radial-gradient(circle_at_top_right,rgba(114,233,212,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(91,115,217,0.16),transparent_30%)]"
          />

          <HeroReveal className="relative z-10 flex flex-col gap-6">
            <HeroItem>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-4">
                  <Logo size="md" tone="light" />
                  <div className="stb-control-ribbon">
                    <span className="stb-section-kicker !text-[rgba(114,233,212,0.88)]">
                      {locale === "ar" ? "نظام مُدار" : "Managed system"}
                    </span>
                    <span className="inline-flex items-center gap-2 text-sm">
                      <ShieldCheck className="h-4 w-4 text-emerald-300" />
                      {locale === "ar"
                        ? "الضوابط والمراجعة مرئية"
                        : "Controls and review are visible"}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <LanguageSwitcher tone="light" />
                  <div className="stb-data-chip border-white/12 bg-white/6 text-white/84">
                    <Bell className="h-4 w-4 text-white/70" />
                    <span>{locale === "ar" ? "لا توجد تنبيهات" : "No alerts"}</span>
                  </div>
                  <div className="stb-data-chip border-white/12 bg-white/6 text-white/84">
                    <CircleHelp className="h-4 w-4 text-white/70" />
                    <span>{locale === "ar" ? "المساعدة والأمان" : "Help & safety"}</span>
                  </div>
                </div>
              </div>
            </HeroItem>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <HeroItem className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300/90">
                  {locale === "ar" ? "الخدمات المصرفية على إيثيريوم" : "Ethereum banking workspace"}
                </p>
                <h1 className="stb-page-title max-w-3xl text-3xl font-semibold text-white sm:text-4xl">
                  {currentSection}
                </h1>
                <p className="max-w-3xl text-sm leading-7 text-white/70 sm:text-base">
                  {locale === "ar"
                    ? "ملخص واضح للأموال والحالة والخطوة التالية. يتم إبقاء تفاصيل السلسلة متاحة عند الحاجة فقط."
                    : "A clear summary of money, status, and next steps. Chain-level detail stays available when you need it, not before."}
                </p>
              </HeroItem>

              <StaggerGrid className="grid gap-3 sm:grid-cols-3" delay={0.16}>
                <StaggerItem>
                  <div className="stb-hero-stat">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/54">
                      <Wallet className="h-3.5 w-3.5" />
                      {locale === "ar" ? "مرجع المحفظة" : "Wallet reference"}
                    </div>
                    <strong className="stb-ref text-sm font-medium text-white">
                      <bdi>{formatShortAddress(user?.ethereumAddress, t("layout.noWallet"))}</bdi>
                    </strong>
                  </div>
                </StaggerItem>
                <StaggerItem>
                  <div className="stb-hero-stat">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/54">
                      <Landmark className="h-3.5 w-3.5" />
                      {locale === "ar" ? "الحساب" : "Account"}
                    </div>
                    <strong className="text-sm font-medium text-white">
                      {user?.email ?? (locale === "ar" ? "غير متاح" : "Not available")}
                    </strong>
                  </div>
                </StaggerItem>
                <StaggerItem>
                  <div className="stb-hero-stat">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/54">
                      <UserRound className="h-3.5 w-3.5" />
                      {locale === "ar" ? "آخر تحديث" : "Last updated"}
                    </div>
                    <strong className="text-sm font-medium text-white">
                      {formatDateLabel(new Date().toISOString(), locale)}
                    </strong>
                  </div>
                </StaggerItem>
              </StaggerGrid>
            </div>
          </HeroReveal>
        </header>

        <div className="stb-reveal mt-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between" data-delay="1">
          <MotionSurface className="stb-pressable-shell">
            <nav className="stb-surface rounded-[1.4rem] p-2">
              <div className="flex flex-wrap items-center gap-2">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.path;

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn(
                        "rounded-[1rem] px-4 py-3 text-sm font-semibold transition-[background-color,color,transform,box-shadow] duration-200",
                        isActive
                          ? "bg-slate-950 text-white shadow-[0_14px_34px_rgba(10,18,28,0.18)]"
                          : "text-slate-600 hover:-translate-y-0.5 hover:bg-white/75 hover:text-slate-950"
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </nav>
          </MotionSurface>

          <StaggerGrid className="flex flex-wrap items-center gap-3" delay={0.12}>
            <StaggerItem>
              <Button
                asChild
                variant="outline"
                className="border-slate-200 bg-white/80 px-5"
              >
                <Link to="/proofs/me">
                  {locale === "ar" ? "إثباتي" : "My proof"}
                </Link>
              </Button>
            </StaggerItem>
            <StaggerItem>
              <Button
                asChild
                variant="outline"
                className="border-slate-200 bg-white/80 px-5"
              >
                <Link to="/loans">
                  {locale === "ar" ? "القروض المُدارة" : "Managed loans"}
                </Link>
              </Button>
            </StaggerItem>
          </StaggerGrid>
        </div>

        <main className="mt-6 flex-1">{children}</main>
      </div>
    </div>
  );
};
