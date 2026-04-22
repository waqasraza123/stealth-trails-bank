import "./global.css";
import "react-native-gesture-handler";
import "react-native-reanimated";

import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import { NavigationContainer } from "@react-navigation/native";
import { queryClient } from "./src/lib/query-client";
import { MobileI18nProvider } from "./src/i18n/provider";
import { AppNavigator } from "./src/navigation/AppNavigator";
import { useT } from "./src/i18n/use-t";
import { AppErrorBoundary } from "./src/components/system/AppErrorBoundary";
import { AppFeedbackProvider } from "./src/components/system/AppFeedbackProvider";

function MobileShell() {
  const t = useT();

  return (
    <AppErrorBoundary
      title={t("common.somethingWentWrong")}
      message={t("common.crashRecovery")}
      actionLabel={t("common.reset")}
    >
      <AppFeedbackProvider>
        <NavigationContainer>
          <StatusBar style="dark" />
          <AppNavigator />
        </NavigationContainer>
      </AppFeedbackProvider>
    </AppErrorBoundary>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <MobileI18nProvider>
            <MobileShell />
          </MobileI18nProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
