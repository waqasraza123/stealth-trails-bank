import { Pressable, ScrollView } from "react-native";
import { AppText } from "./AppText";

type Option = {
  label: string;
  value: string;
};

type OptionChipsProps = {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
};

export function OptionChips({
  options,
  value,
  onChange
}: OptionChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-2"
    >
      {options.map((option) => {
        const active = option.value === value;

        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            className={`rounded-full border px-4 py-2 ${
              active ? "border-ink bg-ink" : "border-border bg-white"
            }`}
          >
            <AppText
              className={`text-sm ${active ? "text-white" : "text-ink"}`}
              weight="semibold"
            >
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
