import { View } from "react-native";
import { AppText } from "./AppText";

type StatusChipProps = {
  label: string;
  tone: "neutral" | "positive" | "warning" | "critical" | "technical";
};

export function StatusChip({ label, tone }: StatusChipProps) {
  const classes =
    tone === "positive"
      ? "bg-mint/15 border-mint/30"
      : tone === "warning"
        ? "bg-amber-100 border-amber-400/40"
        : tone === "critical"
          ? "bg-red-50 border-danger/30"
          : tone === "technical"
            ? "bg-sky-100 border-sky-300"
            : "bg-sand border-border";

  return (
    <View className={`rounded-full border px-3 py-1.5 ${classes}`}>
      <AppText className="text-xs text-ink" weight="semibold">
        {label}
      </AppText>
    </View>
  );
}
