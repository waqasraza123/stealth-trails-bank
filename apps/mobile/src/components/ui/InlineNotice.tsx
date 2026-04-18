import { View } from "react-native";
import { AppText } from "./AppText";

type InlineNoticeProps = {
  tone?: "neutral" | "positive" | "warning" | "critical";
  message: string;
};

export function InlineNotice({
  tone = "neutral",
  message
}: InlineNoticeProps) {
  const classes =
    tone === "positive"
      ? "border-mint/30 bg-mint/10"
      : tone === "warning"
        ? "border-amber-400/40 bg-amber-100"
        : tone === "critical"
          ? "border-danger/30 bg-red-50"
          : "border-border bg-sand";
  const textTone =
    tone === "critical"
      ? "text-danger"
      : tone === "warning"
        ? "text-amber-900"
        : "text-ink";

  return (
    <View className={`rounded-2xl border px-4 py-3 ${classes}`}>
      <AppText className={`text-sm ${textTone}`}>{message}</AppText>
    </View>
  );
}
