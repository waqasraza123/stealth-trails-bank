import { Pressable, View } from "react-native";
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

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      className={`${fullWidth ? "w-full" : ""} rounded-full px-4 py-3 ${variantClasses} ${
        disabled ? "opacity-50" : ""
      }`}
    >
      <View className="items-center">
        <AppText className={`${textClasses} text-sm`} weight="semibold">
          {label}
        </AppText>
      </View>
    </Pressable>
  );
}
