import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import type { SupportedLocale } from "@stealth-trails-bank/i18n";

const localeStorageKey = "stb.mobile.locale";

type LocaleState = {
  locale: SupportedLocale;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setLocale: (locale: SupportedLocale) => Promise<void>;
};

export const useLocaleStore = create<LocaleState>((set) => ({
  locale: "en",
  hydrated: false,
  hydrate: async () => {
    const storedLocale = await AsyncStorage.getItem(localeStorageKey);
    set({
      locale: storedLocale === "ar" ? "ar" : "en",
      hydrated: true
    });
  },
  setLocale: async (locale) => {
    await AsyncStorage.setItem(localeStorageKey, locale);
    set({ locale });
  }
}));
