import { Pressable, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNotificationUnreadSummaryQuery } from "../../hooks/use-notifications";
import type { RootStackParamList } from "../../navigation/types";
import { AppText } from "./AppText";

export function NotificationBellButton() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const unreadSummaryQuery = useNotificationUnreadSummaryQuery();
  const unreadCount = unreadSummaryQuery.data?.unreadCount ?? 0;

  return (
    <Pressable
      accessibilityLabel="Open notifications"
      accessibilityRole="button"
      className="relative rounded-full border border-border bg-white px-3 py-3"
      onPress={() => navigation.navigate("Notifications")}
    >
      <MaterialCommunityIcons color="#14212b" name="bell-outline" size={18} />
      {unreadCount > 0 ? (
        <View className="absolute -right-1 -top-1 min-w-[18px] items-center rounded-full bg-sea px-1 py-[1px]">
          <AppText className="text-[10px] text-ink" weight="bold">
            {unreadCount > 99 ? "99+" : String(unreadCount)}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}
