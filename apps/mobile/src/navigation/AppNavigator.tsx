import {
  Cairo_500Medium,
  Cairo_600SemiBold,
  Cairo_700Bold,
  useFonts as useCairoFonts
} from "@expo-google-fonts/cairo";
import {
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  useFonts as usePlusJakartaFonts
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
  RootStackParamList
} from "./types";
import { DashboardScreen } from "../screens/DashboardScreen";
import { WalletScreen } from "../screens/WalletScreen";
import { YieldScreen } from "../screens/YieldScreen";
import { TransactionsScreen } from "../screens/TransactionsScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { LoansScreen } from "../screens/LoansScreen";
import { SignInScreen } from "../screens/auth/SignInScreen";
import { SignUpScreen } from "../screens/auth/SignUpScreen";
import { AppButton } from "../components/ui/AppButton";

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainTabs = createBottomTabNavigator<MainTabParamList>();

function LoadingGate({ message }: { message: string }) {
  return (
    <View className="flex-1 items-center justify-center bg-parchment px-8">
      <AppText className="text-center text-base text-ink" weight="semibold">
        {message}
      </AppText>
    </View>
  );
}

function ProfileBootstrapBlock({
  onRetry,
  message
}: {
  onRetry: () => void;
  message: string;
}) {
  const t = useT();

  return (
    <View className="flex-1 items-center justify-center gap-4 bg-parchment px-8">
      <AppText className="text-center text-base text-ink">{message}</AppText>
      <AppButton label={t("common.retry")} onPress={onRetry} fullWidth={false} />
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

  return (
    <MainTabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#fffdf8",
          borderTopColor: "#d7d0c5",
          height: 74,
          paddingTop: 10
        },
        tabBarLabelStyle: {
          fontSize: 11
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
        }
      })}
    >
      <MainTabs.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ tabBarLabel: t("navigation.dashboard") }}
      />
      <MainTabs.Screen
        name="Wallet"
        component={WalletScreen}
        options={{ tabBarLabel: t("navigation.wallet") }}
      />
      <MainTabs.Screen
        name="Yield"
        component={YieldScreen}
        options={{ tabBarLabel: t("navigation.yield") }}
      />
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

  return (
    <RootStack.Navigator>
      <RootStack.Screen
        name="MainTabs"
        component={SignedInTabs}
        options={{ headerShown: false }}
      />
      <RootStack.Screen
        name="Loans"
        component={LoansScreen}
        options={{ title: t("navigation.loans") }}
      />
    </RootStack.Navigator>
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
    PlusJakartaSans_700Bold
  });
  const [cairoReady] = useCairoFonts({
    Cairo_500Medium,
    Cairo_600SemiBold,
    Cairo_700Bold
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
