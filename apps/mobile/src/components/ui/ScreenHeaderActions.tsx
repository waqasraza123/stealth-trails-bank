import { View } from "react-native";
import { LanguageToggle } from "./LanguageToggle";
import { NotificationBellButton } from "./NotificationBellButton";

export function ScreenHeaderActions() {
  return (
    <View className="flex-row items-start gap-3">
      <NotificationBellButton />
      <LanguageToggle />
    </View>
  );
}
