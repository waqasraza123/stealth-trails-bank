import {
  Text,
  type StyleProp,
  type TextProps,
  type TextStyle
} from "react-native";
import { useLocale } from "../../i18n/use-locale";

type AppTextProps = TextProps & {
  weight?: "regular" | "medium" | "semibold" | "bold";
  className?: string;
  style?: StyleProp<TextStyle>;
};

function resolveFontFamily(
  locale: "en" | "ar",
  weight: NonNullable<AppTextProps["weight"]>
) {
  if (locale === "ar") {
    switch (weight) {
      case "bold":
        return "Cairo_700Bold";
      case "semibold":
        return "Cairo_600SemiBold";
      case "medium":
        return "Cairo_500Medium";
      default:
        return "Cairo_500Medium";
    }
  }

  switch (weight) {
    case "bold":
      return "PlusJakartaSans_700Bold";
    case "semibold":
      return "PlusJakartaSans_600SemiBold";
    case "medium":
      return "PlusJakartaSans_500Medium";
    default:
      return "PlusJakartaSans_500Medium";
  }
}

export function AppText({
  weight = "regular",
  style,
  children,
  ...props
}: AppTextProps) {
  const { locale } = useLocale();

  return (
    <Text
      {...props}
      style={[
        {
          fontFamily: resolveFontFamily(locale, weight)
        },
        style
      ]}
    >
      {children}
    </Text>
  );
}
