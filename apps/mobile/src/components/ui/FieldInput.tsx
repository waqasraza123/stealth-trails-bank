import { TextInput, View, type TextInputProps } from "react-native";
import { AppText } from "./AppText";

type FieldInputProps = TextInputProps & {
  label: string;
  helper?: string | null;
};

export function FieldInput({
  label,
  helper,
  className,
  ...props
}: FieldInputProps) {
  return (
    <View className="gap-2">
      <AppText className="text-sm text-slate" weight="semibold">
        {label}
      </AppText>
      <TextInput
        {...props}
        className={`rounded-2xl border border-border bg-white px-4 py-3 text-base text-ink ${className ?? ""}`}
        placeholderTextColor="#72808d"
      />
      {helper ? (
        <AppText className="text-xs text-slate">{helper}</AppText>
      ) : null}
    </View>
  );
}
