import {
  createTranslator,
  formatCount,
  formatDateLabel,
  formatDateTimeLabel,
  formatDecimalString,
  resolveLocaleDirection,
  type SupportedLocale
} from "@stealth-trails-bank/i18n";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode
} from "react";
import { mobileMessages, type MobileMessages } from "./messages/en";
import { mobileMessagesAr } from "./messages/ar";
import { useLocaleStore } from "../stores/locale-store";

const catalogs: Record<SupportedLocale, MobileMessages> = {
  en: mobileMessages,
  ar: mobileMessagesAr
};

type MobileI18nValue = {
  locale: SupportedLocale;
  direction: "ltr" | "rtl";
  isRtl: boolean;
  hydrated: boolean;
  setLocale: (locale: SupportedLocale) => Promise<void>;
  t: ReturnType<typeof createTranslator<MobileMessages>>;
  formatters: {
    decimal: (value: string | null | undefined, maxFractionDigits?: number) => string;
    count: (value: number) => string;
    date: (value: string | Date) => string;
    dateTime: (value: string | Date | null | undefined) => string;
  };
};

const MobileI18nContext = createContext<MobileI18nValue | null>(null);

export function MobileI18nProvider({ children }: { children: ReactNode }) {
  const locale = useLocaleStore((state) => state.locale);
  const hydrated = useLocaleStore((state) => state.hydrated);
  const hydrate = useLocaleStore((state) => state.hydrate);
  const setLocale = useLocaleStore((state) => state.setLocale);

  useEffect(() => {
    if (!hydrated) {
      void hydrate();
    }
  }, [hydrate, hydrated]);

  const value = useMemo<MobileI18nValue>(() => {
    const direction = resolveLocaleDirection(locale);
    const t = createTranslator(catalogs[locale]);

    return {
      locale,
      direction,
      isRtl: direction === "rtl",
      hydrated,
      setLocale,
      t,
      formatters: {
        decimal: (value, maxFractionDigits) =>
          formatDecimalString(value, locale, maxFractionDigits),
        count: (value) => formatCount(value, locale),
        date: (value) => formatDateLabel(value, locale),
        dateTime: (value) => formatDateTimeLabel(value, locale)
      }
    };
  }, [hydrated, locale, setLocale]);

  return (
    <MobileI18nContext.Provider value={value}>
      {children}
    </MobileI18nContext.Provider>
  );
}

export function useMobileI18n() {
  const context = useContext(MobileI18nContext);

  if (!context) {
    throw new Error("useMobileI18n must be used within MobileI18nProvider.");
  }

  return context;
}
