import { useId } from "react";
import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
  tone?: "default" | "light" | "dark";
  showWordmark?: boolean;
};

const sizeClasses = {
  sm: {
    icon: "h-9 w-9",
    wordmark: "text-base",
  },
  md: {
    icon: "h-11 w-11",
    wordmark: "text-xl",
  },
  lg: {
    icon: "h-14 w-14",
    wordmark: "text-[1.7rem]",
  },
};

const toneClasses = {
  default: {
    markBase: "text-slate-950",
    markAccent: "text-emerald-500",
    wordmark: "text-foreground",
  },
  light: {
    markBase: "text-auth-foreground",
    markAccent: "text-auth-accent",
    wordmark: "text-auth-foreground",
  },
  dark: {
    markBase: "text-auth-form-foreground",
    markAccent: "text-auth-form-accent",
    wordmark: "text-auth-form-foreground",
  },
};

export const Logo = ({
  className,
  size = "md",
  tone = "default",
  showWordmark = true,
}: LogoProps) => {
  const shadowId = useId();
  const sizing = sizeClasses[size];
  const tones = toneClasses[tone];

  return (
    <div className={cn("inline-flex items-center gap-3", className)}>
      <svg
        viewBox="0 0 48 48"
        className={cn("shrink-0", sizing.icon)}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
    >
      <defs>
        <filter id={shadowId} x="0" y="0" width="48" height="48" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="10" stdDeviation="10" floodOpacity="0.18" />
        </filter>
      </defs>
      <g filter={`url(#${shadowId})`}>
          <rect
            x="4"
            y="4"
            width="40"
          height="40"
          rx="14"
          className={tones.markBase}
          fill="currentColor"
        />
          <rect
            x="10"
            y="10"
            width="28"
            height="28"
            rx="10"
            fill="rgba(255,255,255,0.08)"
            stroke="rgba(255,255,255,0.16)"
          />
          <path
            d="M24 12L31.75 21L24 35L16.25 21L24 12Z"
            className={tones.markAccent}
            stroke="currentColor"
            strokeWidth="1.9"
          />
          <path
            d="M24 12V35M16.25 21H31.75"
            className={tones.markAccent}
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
          />
          <path
            d="M13 16.5H18M30 16.5H35M13 28.5H18M30 28.5H35"
            stroke="rgba(255,255,255,0.34)"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </g>
      </svg>
      {showWordmark ? (
        <span
          className={cn(
            "auth-display font-semibold tracking-[-0.04em]",
            sizing.wordmark,
            tones.wordmark
          )}
        >
          Stealth Trails
        </span>
      ) : null}
    </div>
  );
};
