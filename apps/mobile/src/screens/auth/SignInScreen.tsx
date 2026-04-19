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
import { EthereumBrandPanel } from "../../components/ui/EthereumBrandPanel";
import { AnimatedSection } from "../../components/ui/AnimatedSection";
import { useAuthActions } from "../../hooks/use-session";
import { useT } from "../../i18n/use-t";
import {
  hasMinimumLength,
  isEmailAddress,
  isNonEmptyValue,
} from "../../lib/validation";
import type { AuthStackParamList } from "../../navigation/types";

const sharedLoginCredentials = {
  email: "admin@gmail.com",
  password: "P@ssw0rd",
};

export function SignInScreen() {
  const t = useT();
  const navigation =
    useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { signIn, loading, error } = useAuthActions();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit() {
    if (!isEmailAddress(email)) {
      Alert.alert(t("auth.signIn"), t("auth.emailInvalid"));
      return;
    }

    if (!isNonEmptyValue(password)) {
      Alert.alert(t("auth.signIn"), t("common.requiredField"));
      return;
    }

    if (!hasMinimumLength(password, 8)) {
      Alert.alert(t("auth.signIn"), t("auth.passwordTooShort"));
      return;
    }

    try {
      await signIn({ email: email.trim(), password: password.trim() });
    } catch (requestError) {
      Alert.alert(
        t("auth.signIn"),
        requestError instanceof Error
          ? requestError.message
          : String(requestError),
      );
    }
  }

  return (
    <AppScreen
      title={t("auth.signInTitle")}
      subtitle={t("auth.signInDescription")}
      trailing={<LanguageToggle />}>
      <View className="gap-4">
        <AnimatedSection delayOrder={1} variant="up">
          <EthereumBrandPanel
            subtitle="Battle-tested Ethereum bank with advanced privacy features"
            testID="ethereum-brand-panel"
          />
        </AnimatedSection>
        <AnimatedSection delayOrder={2}>
          <FieldInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            label={t("auth.email")}
            onChangeText={setEmail}
            value={email}
          />
        </AnimatedSection>
        <AnimatedSection delayOrder={3}>
          <FieldInput
            autoCapitalize="none"
            label={t("auth.password")}
            onChangeText={setPassword}
            secureTextEntry
            value={password}
          />
        </AnimatedSection>
        {error ? (
          <AnimatedSection delayOrder={4}>
            <InlineNotice message={error} tone="critical" />
          </AnimatedSection>
        ) : null}
        <AnimatedSection delayOrder={5} className="gap-3">
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
        </AnimatedSection>
        <AnimatedSection delayOrder={6}>
          <Pressable
            onPress={() => {
              navigation.navigate("SignUp");
            }}>
            <AppText className="text-center text-sm text-slate">
              {t("auth.switchToSignUp")}
            </AppText>
          </Pressable>
        </AnimatedSection>
      </View>
    </AppScreen>
  );
}
