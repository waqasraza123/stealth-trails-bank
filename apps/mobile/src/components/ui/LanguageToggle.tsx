import { View } from "react-native";
import { AppButton } from "./AppButton";
import { useLocale } from "../../i18n/use-locale";
import { useT } from "../../i18n/use-t";

export function LanguageToggle() {
  const { locale, setLocale } = useLocale();
  const t = useT();

  return (
    <View className="w-36 gap-2">
      <AppButton
        label={locale === "en" ? t("locale.english") : t("locale.arabic")}
        onPress={() => {
          void setLocale(locale === "en" ? "ar" : "en");
        }}
        variant="secondary"
        fullWidth
      />
    </View>
  );
}
