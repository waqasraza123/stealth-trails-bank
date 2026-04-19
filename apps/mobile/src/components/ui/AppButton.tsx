import { Pressable, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from "react-native-reanimated";
import { motionDurations, motionProfiles } from "@stealth-trails-bank/ui-foundation";
import { AppText } from "./AppText";

type AppButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  fullWidth?: boolean;
};

export function AppButton({
  label,
  onPress,
  disabled = false,
  variant = "primary",
  fullWidth = true
}: AppButtonProps) {
  const variantClasses =
    variant === "secondary"
      ? "bg-sand border border-border"
      : variant === "ghost"
        ? "bg-transparent border border-transparent"
        : variant === "danger"
          ? "bg-danger"
          : "bg-ink";
  const textClasses =
    variant === "secondary" || variant === "ghost"
      ? "text-ink"
      : "text-white";
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => {
        scale.value = withTiming(motionProfiles.mobile.pressScale, {
          duration: motionDurations.fastMs
        });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, {
          duration: motionDurations.fastMs
        });
      }}
      className={`${fullWidth ? "w-full" : ""} rounded-full px-4 py-3 ${variantClasses} ${
        disabled ? "opacity-50" : ""
      }`}
    >
      <Animated.View style={animatedStyle}>
        <View className="items-center">
          <AppText className={`${textClasses} text-sm`} weight="semibold">
            {label}
          </AppText>
        </View>
      </Animated.View>
    </Pressable>
  );
}
