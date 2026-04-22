import type { ReactElement } from "react";
import { render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { SupportedLocale } from "@stealth-trails-bank/i18n";
import { MobileI18nProvider } from "../i18n/provider";
import { useLocaleStore } from "../stores/locale-store";
import { useSessionStore } from "../stores/session-store";
import type { SessionUser } from "../lib/api/types";
import { AppFeedbackProvider } from "../components/system/AppFeedbackProvider";

type RenderMobileOptions = {
  locale?: SupportedLocale;
  token?: string | null;
  user?: SessionUser | null;
};

export function primeMobileStores(options: RenderMobileOptions = {}) {
  useLocaleStore.setState({
    locale: options.locale ?? "en",
    hydrated: true
  });

  useSessionStore.setState({
    token: options.token ?? null,
    user: options.user ?? null,
    hydrated: true,
    pendingRequestKeys: {}
  });
}

export function renderMobile(
  component: ReactElement,
  options: RenderMobileOptions = {}
) {
  primeMobileStores(options);

  return render(
    <SafeAreaProvider>
      <MobileI18nProvider>
        <AppFeedbackProvider>{component}</AppFeedbackProvider>
      </MobileI18nProvider>
    </SafeAreaProvider>
  );
}
