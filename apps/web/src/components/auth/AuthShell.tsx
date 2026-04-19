import { Building2, Landmark, ShieldCheck } from "lucide-react";
import { ReactNode } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import {
  HeroItem,
  HeroReveal,
  MotionSurface,
  ScreenTransition,
  StaggerGrid,
  StaggerItem
} from "@/components/motion/primitives";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/use-t";

type AuthShellProps = {
  formEyebrow: string;
  formTitle: string;
  formDescription: string;
  brandEyebrow: string;
  brandTitle: string;
  brandDescription: string;
  chips: string[];
  children: ReactNode;
  footer: ReactNode;
  className?: string;
};

const chipIcons = [ShieldCheck, Landmark, Building2];

function AuthBrandArt() {
  return (
    <div
      aria-hidden="true"
      className="auth-hero-art relative overflow-hidden rounded-[2rem] border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.06)] p-6 shadow-[0_24px_80px_rgba(4,10,20,0.32)]"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(114,233,212,0.18),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(70,142,255,0.16),transparent_32%)]" />
      <div className="absolute inset-0 auth-ledger-grid opacity-40" />
      <svg
        viewBox="0 0 520 360"
        className="relative z-10 h-full w-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect
          x="64"
          y="52"
          width="392"
          height="256"
          rx="32"
          stroke="rgba(242,239,230,0.24)"
        />
        <path
          d="M260 78L332 164L260 278L188 164L260 78Z"
          stroke="rgba(134,196,255,0.92)"
          strokeWidth="2"
        />
        <path
          d="M260 78V278M188 164H332"
          stroke="rgba(114,233,212,0.92)"
          strokeWidth="2"
        />
        <path
          d="M130 112H204M316 112H390M130 216H204M316 216H390"
          stroke="rgba(242,239,230,0.34)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M96 164H166M354 164H424"
          stroke="rgba(242,239,230,0.42)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <rect
          x="148"
          y="126"
          width="224"
          height="76"
          rx="20"
          fill="rgba(7,17,29,0.54)"
          stroke="rgba(242,239,230,0.12)"
        />
        <path
          d="M218 164L260 122L302 164L260 206L218 164Z"
          fill="rgba(91,175,255,0.18)"
          stroke="rgba(134,196,255,0.88)"
        />
        <path
          d="M205 239H315"
          stroke="rgba(114,233,212,0.48)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

export function AuthShell({
  formEyebrow,
  formTitle,
  formDescription,
  brandEyebrow,
  brandTitle,
  brandDescription,
  chips,
  children,
  footer,
  className
}: AuthShellProps) {
  const t = useT();

  return (
    <div className="auth-shell-bg min-h-screen">
      <div className="mx-auto grid min-h-screen max-w-[1500px] lg:grid-cols-[minmax(0,1.08fr)_minmax(460px,560px)]">
        <section className="relative overflow-hidden px-5 pb-8 pt-6 sm:px-8 lg:px-10 lg:py-10">
          <div className="absolute inset-0 auth-ledger-grid opacity-20" />
          <div className="stb-ambient-orb stb-ambient-orb--emerald absolute left-[-5rem] top-[6rem] h-44 w-44" />
          <div className="stb-ambient-orb stb-ambient-orb--indigo absolute right-[4rem] top-[12rem] h-40 w-40" />
          <div className="stb-ambient-orb stb-ambient-orb--gold absolute bottom-[4rem] left-[10rem] h-36 w-36" />

          <HeroReveal className="relative z-10 flex h-full flex-col rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(15,24,38,0.9),rgba(11,18,29,0.94))] px-6 py-6 shadow-[0_40px_120px_rgba(4,10,20,0.45)] sm:px-8 sm:py-8 lg:px-10 lg:py-10">
            <HeroItem>
              <div className="flex flex-wrap items-center justify-between gap-6">
                <Logo size="lg" tone="light" className="shrink-0" />
                <div className="flex items-center gap-3">
                  <div className="hidden rounded-full border border-[rgba(255,255,255,0.12)] bg-white/5 px-4 py-2 text-[0.68rem] font-medium uppercase tracking-[0.24em] text-[rgba(255,255,255,0.64)] sm:block">
                    {t("auth.managedRails")}
                  </div>
                  <LanguageSwitcher tone="light" />
                </div>
              </div>
            </HeroItem>

            <HeroItem className="mt-12 max-w-xl space-y-6 lg:mt-16">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-auth-accent">
                {brandEyebrow}
              </p>
              <h1 className="auth-display text-4xl font-semibold leading-[1.02] tracking-[-0.04em] text-auth-foreground sm:text-5xl lg:text-[3.75rem]">
                {brandTitle}
              </h1>
              <p className="max-w-lg text-sm leading-7 text-auth-muted sm:text-base">
                {brandDescription}
              </p>
            </HeroItem>

            <HeroItem className="mt-10">
              <MotionSurface className="stb-pressable-shell">
                <AuthBrandArt />
              </MotionSurface>
            </HeroItem>

            <StaggerGrid className="mt-8 flex flex-wrap gap-3">
              {chips.map((chip, index) => {
                const Icon = chipIcons[index] ?? ShieldCheck;

                return (
                  <StaggerItem key={chip}>
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[rgba(255,255,255,0.06)] px-3 py-2 text-xs font-medium text-[rgba(242,239,230,0.88)] backdrop-blur">
                      <Icon className="h-3.5 w-3.5 text-auth-accent" />
                      <span>{chip}</span>
                    </div>
                  </StaggerItem>
                );
              })}
            </StaggerGrid>
          </HeroReveal>
        </section>

        <section className="relative flex items-center px-5 pb-8 pt-2 sm:px-8 lg:px-8 lg:py-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(114,233,212,0.08),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(70,142,255,0.08),transparent_24%)]" />
          <div className="stb-ambient-orb stb-ambient-orb--indigo absolute bottom-[5rem] right-[2rem] h-36 w-36 opacity-60" />

          <ScreenTransition
            className={cn(
              "relative z-10 mx-auto w-full max-w-[31rem] rounded-[2rem] border border-[rgba(10,18,30,0.06)] bg-[linear-gradient(180deg,rgba(253,251,246,0.96),rgba(248,245,238,0.93))] p-6 shadow-[0_30px_90px_rgba(10,18,30,0.14)] backdrop-blur sm:p-8",
              className
            )}
          >
            <div className="mb-8">
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-auth-form-accent">
                {formEyebrow}
              </p>
              <h2 className="auth-display mt-4 text-3xl font-semibold tracking-[-0.04em] text-auth-form-foreground sm:text-[2.15rem]">
                {formTitle}
              </h2>
              <p className="mt-3 text-sm leading-7 text-auth-form-muted">
                {formDescription}
              </p>
            </div>

            {children}

            <div className="mt-8 border-t border-[rgba(10,18,30,0.08)] pt-5 text-sm text-auth-form-muted">
              {footer}
            </div>
          </ScreenTransition>
        </section>
      </div>
    </div>
  );
}
