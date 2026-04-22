import { Pressable, View } from "react-native";
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
import { useScreenFeedback } from "../../hooks/use-app-feedback";
import { useT } from "../../i18n/use-t";
import {
  hasMinimumLength,
  isEmailAddress,
  isNonEmptyValue
} from "../../lib/validation";
import type { AuthStackParamList } from "../../navigation/types";

export function SignUpScreen() {
  const t = useT();
  const navigation =
    useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { signUp, loading, error } = useAuthActions();
  const feedback = useScreenFeedback(t("auth.signUp"));
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit() {
    if (
      !isNonEmptyValue(firstName) ||
      !isNonEmptyValue(lastName) ||
      !isNonEmptyValue(email) ||
      !isNonEmptyValue(password)
    ) {
      feedback.warning(t("common.requiredField"));
      return;
    }

    if (!isEmailAddress(email)) {
      feedback.warning(t("auth.emailInvalid"));
      return;
    }

    if (!hasMinimumLength(password, 8)) {
      feedback.warning(t("auth.passwordTooShort"));
      return;
    }

    try {
      await signUp({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password: password.trim()
      });
      feedback.success(t("auth.switchToSignIn"));
      navigation.navigate("SignIn");
    } catch (requestError) {
      feedback.errorFrom(requestError);
    }
  }

  return (
    <AppScreen
      title={t("auth.signUpTitle")}
      subtitle={t("auth.signUpDescription")}
      trailing={<LanguageToggle />}
    >
      <View className="gap-4">
        <FieldInput label={t("auth.firstName")} onChangeText={setFirstName} value={firstName} />
        <FieldInput label={t("auth.lastName")} onChangeText={setLastName} value={lastName} />
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
          label={t("auth.signUp")}
          onPress={() => {
            void handleSubmit();
          }}
        />
        <Pressable
          onPress={() => {
            navigation.navigate("SignIn");
          }}
        >
          <AppText className="text-center text-sm text-slate">
            {t("auth.switchToSignIn")}
          </AppText>
        </Pressable>
      </View>
    </AppScreen>
  );
}
