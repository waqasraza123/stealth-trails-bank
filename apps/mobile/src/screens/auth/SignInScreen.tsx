import { Alert, Pressable, View } from "react-native";
import { useState } from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppScreen } from "../../components/ui/AppScreen";
import { AppButton } from "../../components/ui/AppButton";
import { AppText } from "../../components/ui/AppText";
import { FieldInput } from "../../components/ui/FieldInput";
import { InlineNotice } from "../../components/ui/InlineNotice";
import { LanguageToggle } from "../../components/ui/LanguageToggle";
import { useAuthActions } from "../../hooks/use-session";
import { useT } from "../../i18n/use-t";
import type { AuthStackParamList } from "../../navigation/types";

const sharedLoginCredentials = {
  email: "admin@gmail.com",
  password: "P@ssw0rd"
};

export function SignInScreen() {
  const t = useT();
  const navigation =
    useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { signIn, loading, error } = useAuthActions();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit() {
    try {
      await signIn({ email, password });
    } catch (requestError) {
      Alert.alert(
        t("auth.signIn"),
        requestError instanceof Error ? requestError.message : String(requestError)
      );
    }
  }

  return (
    <AppScreen
      title={t("auth.signInTitle")}
      subtitle={t("auth.signInDescription")}
      trailing={<LanguageToggle />}
    >
      <View className="gap-4">
        <FieldInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          label={t("auth.email")}
          onChangeText={setEmail}
          value={email}
        />
        <FieldInput
          autoCapitalize="none"
          label={t("auth.password")}
          onChangeText={setPassword}
          secureTextEntry
          value={password}
        />
        {error ? <InlineNotice message={error} tone="critical" /> : null}
        <AppButton
          disabled={loading}
          label={t("auth.signIn")}
          onPress={() => {
            void handleSubmit();
          }}
        />
        {__DEV__ ? (
          <AppButton
            label={t("auth.demoFill")}
            onPress={() => {
              setEmail(sharedLoginCredentials.email);
              setPassword(sharedLoginCredentials.password);
            }}
            variant="secondary"
          />
        ) : null}
        <Pressable
          onPress={() => {
            navigation.navigate("SignUp");
          }}
        >
          <AppText className="text-center text-sm text-slate">
            {t("auth.switchToSignUp")}
          </AppText>
        </Pressable>
      </View>
    </AppScreen>
  );
}
