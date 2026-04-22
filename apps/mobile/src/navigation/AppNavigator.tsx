import {
  Cairo_500Medium,
  Cairo_600SemiBold,
  Cairo_700Bold,
  useFonts as useCairoFonts,
} from "@expo-google-fonts/cairo";
import {
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  useFonts as usePlusJakartaFonts,
} from "@expo-google-fonts/plus-jakarta-sans";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { View } from "react-native";
import { useEffect } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { AppText } from "../components/ui/AppText";
import { useLocale } from "../i18n/use-locale";
import { useT } from "../i18n/use-t";
import { useProfileQuery } from "../hooks/use-customer-queries";
import { useSessionStore } from "../stores/session-store";
import type {
  AuthStackParamList,
  MainTabParamList,
  RootStackParamList,
} from "./types";
import { DashboardScreen } from "../screens/DashboardScreen";
import { WalletScreen } from "../screens/WalletScreen";
import { YieldScreen } from "../screens/YieldScreen";
import { TransactionsScreen } from "../screens/TransactionsScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { LoansScreen } from "../screens/LoansScreen";
import { RetirementVaultScreen } from "../screens/RetirementVaultScreen";
import { SignInScreen } from "../screens/auth/SignInScreen";
import { SignUpScreen } from "../screens/auth/SignUpScreen";
import { AppButton } from "../components/ui/AppButton";
import { EthereumBrandPanel } from "../components/ui/EthereumBrandPanel";
import { NotificationRealtimeBridge } from "../components/system/NotificationRealtimeBridge";
import { NotificationsScreen } from "../screens/NotificationsScreen";

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainTabs = createBottomTabNavigator<MainTabParamList>();

function LoadingGate({ message }: { message: string }) {
  return (
    <View className="flex-1 items-center justify-center bg-parchment px-8">
      <View className="w-full max-w-[360px] gap-4">
        <EthereumBrandPanel
          compact
          subtitle="Stealth Trails Bank"
          testID="ethereum-loading-panel"
        />
        <AppText className="text-center text-base text-ink" weight="semibold">
          {message}
        </AppText>
      </View>
    </View>
  );
}

function ProfileBootstrapBlock({
  onRetry,
  message,
}: {
  onRetry: () => void;
  message: string;
}) {
  const t = useT();

  return (
    <View className="flex-1 items-center justify-center gap-4 bg-parchment px-8">
      <AppText className="text-center text-base text-ink">{message}</AppText>
      <AppButton
        label={t("common.retry")}
        onPress={onRetry}
        fullWidth={false}
      />
    </View>
  );
}

function SignedOutNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="SignIn" component={SignInScreen} />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
    </AuthStack.Navigator>
  );
}

function SignedInTabs() {
  const t = useT();
  const user = useSessionStore((state) => state.user);
  const initialRouteName =
    user?.mfa?.requiresSetup ||
    user?.sessionSecurity?.currentSessionRequiresVerification
      ? "Profile"
      : "Dashboard";

  return (
    <MainTabs.Navigator
      initialRouteName={initialRouteName}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          position: "absolute",
          left: 16,
          right: 16,
          bottom: 14,
          backgroundColor: "#fffdf8",
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: "#d7d0c5",
          borderRadius: 28,
          height: 82,
          paddingTop: 10,
          paddingBottom: 12,
          shadowColor: "#14212b",
          shadowOpacity: 0.08,
          shadowRadius: 18,
          shadowOffset: {
            width: 0,
            height: 10,
          },
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
        },
        tabBarItemStyle: {
          paddingVertical: 2,
        },
        tabBarActiveTintColor: "#14212b",
        tabBarInactiveTintColor: "#72808d",
        tabBarIcon: ({ color, size }) => {
          const iconName =
            route.name === "Dashboard"
              ? "view-dashboard-outline"
              : route.name === "Wallet"
                ? "wallet-outline"
                : route.name === "Yield"
                  ? "sprout-outline"
                  : route.name === "Transactions"
                    ? "swap-horizontal"
                    : "shield-account-outline";

          return (
            <MaterialCommunityIcons
              color={color}
              name={iconName as never}
              size={size}
            />
          );
        },
      })}
    >
      <MainTabs.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ tabBarLabel: t("navigation.dashboard") }}
      />
      <MainTabs.Screen
        name="Wallet"
        options={{ tabBarLabel: t("navigation.wallet") }}
      >
        {({ route }) => <WalletScreen initialFocus={route.params?.focus} />}
      </MainTabs.Screen>
      <MainTabs.Screen
        name="Yield"
        options={{ tabBarLabel: t("navigation.yield") }}
      >
        {({ route }) => <YieldScreen initialFocus={route.params?.focus} />}
      </MainTabs.Screen>
      <MainTabs.Screen
        name="Transactions"
        component={TransactionsScreen}
        options={{ tabBarLabel: t("navigation.transactions") }}
      />
      <MainTabs.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: t("navigation.profile") }}
      />
    </MainTabs.Navigator>
  );
}

function SignedInNavigator() {
  const t = useT();
  const { locale } = useLocale();

  return (
    <>
      <NotificationRealtimeBridge />
      <RootStack.Navigator>
        <RootStack.Screen
          name="MainTabs"
          component={SignedInTabs}
          options={{ headerShown: false }}
        />
        <RootStack.Screen
          name="Notifications"
          component={NotificationsScreen}
          options={{ headerShown: false }}
        />
        <RootStack.Screen
          name="Loans"
          component={LoansScreen}
          options={{ title: t("navigation.loans") }}
        />
        <RootStack.Screen
          name="RetirementVault"
          options={{
            title: locale === "ar" ? "قبو التقاعد" : "Retirement Vault"
          }}
        >
          {({ route }) => (
            <RetirementVaultScreen initialFocus={route.params?.focus} />
          )}
        </RootStack.Screen>
      </RootStack.Navigator>
    </>
  );
}

export function AppNavigator() {
  const t = useT();
  const { hydrated: localeHydrated } = useLocale();
  const token = useSessionStore((state) => state.token);
  const user = useSessionStore((state) => state.user);
  const hydrated = useSessionStore((state) => state.hydrated);
  const hydrate = useSessionStore((state) => state.hydrate);
  const [plusReady] = usePlusJakartaFonts({
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });
  const [cairoReady] = useCairoFonts({
    Cairo_500Medium,
    Cairo_600SemiBold,
    Cairo_700Bold,
  });
  const profileQuery = useProfileQuery();

  useEffect(() => {
    if (!hydrated) {
      void hydrate();
    }
  }, [hydrate, hydrated]);

  const fontsReady = plusReady && cairoReady;
  const shouldBootstrapProfile = hydrated && token && user?.supabaseUserId;

  if (!hydrated || !localeHydrated || !fontsReady) {
    return <LoadingGate message={t("common.loading")} />;
  }

  if (shouldBootstrapProfile && profileQuery.isLoading) {
    return <LoadingGate message={t("common.loading")} />;
  }

  if (shouldBootstrapProfile && profileQuery.isError) {
    return (
      <ProfileBootstrapBlock
        message={
          profileQuery.error instanceof Error
            ? profileQuery.error.message
            : t("auth.sessionExpired")
        }
        onRetry={() => {
          void profileQuery.refetch();
        }}
      />
    );
  }

  return token && user ? <SignedInNavigator /> : <SignedOutNavigator />;
}
