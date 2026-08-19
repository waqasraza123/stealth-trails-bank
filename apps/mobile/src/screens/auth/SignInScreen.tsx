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
import { EthereumBrandPanel } from "../../components/ui/EthereumBrandPanel";
import { useAuthActions } from "../../hooks/use-session";
import { useScreenFeedback } from "../../hooks/use-app-feedback";
import { useT } from "../../i18n/use-t";
import type { LoginResponseData } from "../../lib/api/types";
import { isEmailAddress } from "../../lib/validation";
import type { AuthStackParamList } from "../../navigation/types";

export function SignInScreen() {
  const t = useT();
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const auth = useAuthActions();
  const feedback = useScreenFeedback(t("auth.signIn"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [code, setCode] = useState("");
  const [flow, setFlow] = useState<LoginResponseData | null>(null);
  const [useRecovery, setUseRecovery] = useState(false);

  async function continueFlow(next: LoginResponseData) {
    if (next.nextAction === "enroll_totp" && !next.secret) {
      setFlow(await auth.startTotpEnrollment(next.flowId));
    } else {
      setFlow(next);
    }
  }

  async function handleSubmit() {
    try {
      if (!flow) {
        if (!isEmailAddress(email)) {
          feedback.warning(t("auth.emailInvalid"));
          return;
        }
        if (password.length === 0) {
          feedback.warning(t("common.requiredField"));
          return;
        }
        await continueFlow(await auth.signIn({ email: email.trim(), password }));
      } else if (flow.nextAction === "verify_email") {
        await auth.verifyEmail(email.trim(), code);
        setFlow(null);
        setCode("");
        feedback.success("Email verified. Sign in again to continue.");
      } else if (flow.nextAction === "enroll_totp") {
        await continueFlow(await auth.verifyTotpEnrollment(flow.flowId, code));
        setCode("");
      } else if (flow.nextAction === "verify_totp") {
        await continueFlow(useRecovery
          ? await auth.verifyRecoveryCode(flow.flowId, code)
          : await auth.verifyTotp(flow.flowId, code));
        setCode("");
      } else if (flow.nextAction === "upgrade_password") {
        await continueFlow(await auth.upgradePassword(flow.flowId, newPassword));
        setNewPassword("");
      } else if (flow.nextAction === "setup_recovery_codes") {
        await continueFlow(await auth.setupRecoveryCodes(flow.flowId));
      }
    } catch (requestError) {
      feedback.errorFrom(requestError);
    }
  }

  const challenge = flow?.nextAction;
  return (
    <AppScreen title={challenge ? "Security check" : t("auth.signInTitle")} subtitle={challenge ? "MFA is required before every banking session." : t("auth.signInDescription")} trailing={<LanguageToggle />}>
      <View className="gap-4">
        {!flow ? <EthereumBrandPanel subtitle="Protected Ethereum banking access" testID="ethereum-brand-panel" /> : null}
        {!flow ? <>
          <FieldInput autoCapitalize="none" autoCorrect={false} keyboardType="email-address" label={t("auth.email")} onChangeText={setEmail} value={email} />
          <FieldInput autoCapitalize="none" label={t("auth.password")} onChangeText={setPassword} secureTextEntry value={password} />
        </> : challenge === "upgrade_password" ? <>
          <FieldInput autoCapitalize="none" label="New password (15+ characters)" onChangeText={setNewPassword} secureTextEntry value={newPassword} />
          <AppText className="text-xs text-slate">Common passwords and passwords containing your personal details are blocked.</AppText>
        </> : challenge === "setup_recovery_codes" ? (
          <AppText className="text-sm text-ink">Generate offline recovery codes. They are shown once and each can only be used once.</AppText>
        ) : <>
          {challenge === "verify_email" ? <AppText className="text-sm text-ink">Enter the 8-digit code sent to {email}.</AppText> : null}
          {challenge === "enroll_totp" && flow.secret ? <View className="gap-2 rounded-2xl border border-line p-4"><AppText className="text-sm text-ink">Add this secret to your authenticator app:</AppText><AppText className="font-mono text-sm text-ink">{flow.secret}</AppText></View> : null}
          {challenge === "verify_totp" ? <Pressable onPress={() => { setUseRecovery(!useRecovery); setCode(""); }}><AppText className="text-sm font-semibold text-ink">{useRecovery ? "Use authenticator code" : "Use a recovery code"}</AppText></Pressable> : null}
          <FieldInput autoCapitalize="characters" keyboardType={useRecovery ? "default" : "number-pad"} label={useRecovery ? "Recovery code" : "Security code"} onChangeText={setCode} value={code} />
        </>}
        {flow?.recoveryCodes?.length ? <InlineNotice tone="warning" message={`Store these recovery codes offline:\n${flow.recoveryCodes.join("\n")}`} /> : null}
        {auth.error ? <InlineNotice message={auth.error} tone="critical" /> : null}
        <AppButton disabled={auth.loading} label={challenge === "setup_recovery_codes" ? "Generate recovery codes" : challenge ? "Continue securely" : t("auth.signIn")} loading={auth.loading} onPress={() => void handleSubmit()} />
        {!flow ? <Pressable onPress={() => navigation.navigate("SignUp")}><AppText className="text-center text-sm text-slate">{t("auth.switchToSignUp")}</AppText></Pressable> : null}
      </View>
    </AppScreen>
  );
}
