import type { CompositeNavigationProp } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Wallet:
    | {
        focus?: "deposit" | "withdraw" | "send";
      }
    | undefined;
  Yield:
    | {
        focus?: "stake" | "withdraw" | "claim";
      }
    | undefined;
  Transactions: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  Loans: undefined;
  Notifications: undefined;
  RetirementVault:
    | {
        focus?: "create" | "fund";
      }
    | undefined;
};

export type DashboardNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, "Dashboard">,
  NativeStackNavigationProp<RootStackParamList>
>;
