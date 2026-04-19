import { Alert, Switch, View } from "react-native";
import { useEffect, useState } from "react";
import type { CustomerNotificationPreferences } from "@stealth-trails-bank/types";
import { AppScreen } from "../components/ui/AppScreen";
import { AppButton } from "../components/ui/AppButton";
import { AppText } from "../components/ui/AppText";
import { FieldInput } from "../components/ui/FieldInput";
import { InlineNotice } from "../components/ui/InlineNotice";
import { LanguageToggle } from "../components/ui/LanguageToggle";
import { LtrValue } from "../components/ui/LtrValue";
import { SectionCard } from "../components/ui/SectionCard";
import { StatusChip } from "../components/ui/StatusChip";
import {
  useMfaStatusQuery,
  useProfileQuery,
  useRotatePasswordMutation,
  useRevokeAllCustomerSessionsMutation,
  useStartEmailEnrollmentMutation,
  useStartEmailRecoveryMutation,
  useStartMfaChallengeMutation,
  useStartTotpEnrollmentMutation,
  useUpdateNotificationPreferencesMutation,
  useVerifyEmailEnrollmentMutation,
  useVerifyEmailRecoveryMutation,
  useVerifyMfaChallengeMutation,
  useVerifyTotpEnrollmentMutation,
} from "../hooks/use-customer-queries";
import { useLocale } from "../i18n/use-locale";
import { useT } from "../i18n/use-t";
import { formatAccountStatusLabel, getAccountStatusTone } from "../lib/account";
import { formatDateLabel } from "../lib/finance";
import { hasMinimumLength, isNonEmptyValue } from "../lib/validation";
import { useSessionStore } from "../stores/session-store";

const emptyPasswordForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export function ProfileScreen() {
  const t = useT();
  const { locale } = useLocale();
  const profileQuery = useProfileQuery();
  useMfaStatusQuery();
  const signOut = useSessionStore((state) => state.signOut);
  const sessionUser = useSessionStore((state) => state.user);
  const rotatePasswordMutation = useRotatePasswordMutation();
  const revokeSessionsMutation = useRevokeAllCustomerSessionsMutation();
  const updatePreferencesMutation = useUpdateNotificationPreferencesMutation();
  const startTotpEnrollmentMutation = useStartTotpEnrollmentMutation();
  const verifyTotpEnrollmentMutation = useVerifyTotpEnrollmentMutation();
  const startEmailEnrollmentMutation = useStartEmailEnrollmentMutation();
  const verifyEmailEnrollmentMutation = useVerifyEmailEnrollmentMutation();
  const startEmailRecoveryMutation = useStartEmailRecoveryMutation();
  const verifyEmailRecoveryMutation = useVerifyEmailRecoveryMutation();
  const startMfaChallengeMutation = useStartMfaChallengeMutation();
  const verifyMfaChallengeMutation = useVerifyMfaChallengeMutation();
  const profile = profileQuery.data;
  const mfa = profile?.mfa ?? sessionUser?.mfa;
  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
  const [notificationDraft, setNotificationDraft] =
    useState<CustomerNotificationPreferences | null>(null);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [emailChallengeId, setEmailChallengeId] = useState<string | null>(null);
  const [emailCode, setEmailCode] = useState("");
  const [emailPreviewCode, setEmailPreviewCode] = useState<string | null>(null);
  const [recoveryChallengeId, setRecoveryChallengeId] = useState<string | null>(
    null,
  );
  const [recoveryCode, setRecoveryCode] = useState("");
  const [recoveryPreviewCode, setRecoveryPreviewCode] = useState<string | null>(
    null,
  );
  const [passwordChallengeId, setPasswordChallengeId] = useState<string | null>(
    null,
  );
  const [passwordChallengeMethod, setPasswordChallengeMethod] = useState<
    "totp" | "email_otp"
  >("totp");
  const [passwordChallengeCode, setPasswordChallengeCode] = useState("");
  const [passwordPreviewCode, setPasswordPreviewCode] = useState<string | null>(
    null,
  );

  useEffect(() => {
    setNotificationDraft(profile?.notificationPreferences ?? null);
  }, [profile?.notificationPreferences]);

  const stepUpFresh =
    Boolean(mfa?.stepUpFreshUntil) &&
    Date.parse(mfa?.stepUpFreshUntil ?? "") > Date.now();

  async function handlePasswordUpdate() {
    if (!stepUpFresh) {
      Alert.alert(
        t("profile.passwordManagement"),
        t("profile.mfaPasswordStepUp"),
      );
      return;
    }

    if (
      !isNonEmptyValue(passwordForm.currentPassword) ||
      !isNonEmptyValue(passwordForm.newPassword) ||
      !isNonEmptyValue(passwordForm.confirmPassword)
    ) {
      Alert.alert(t("profile.passwordManagement"), t("common.requiredField"));
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      Alert.alert(
        t("profile.passwordManagement"),
        t("profile.passwordsMustMatch"),
      );
      return;
    }

    if (!hasMinimumLength(passwordForm.newPassword, 8)) {
      Alert.alert(t("profile.passwordManagement"), t("auth.passwordTooShort"));
      return;
    }

    try {
      await rotatePasswordMutation.mutateAsync({
        currentPassword: passwordForm.currentPassword.trim(),
        newPassword: passwordForm.newPassword.trim(),
      });
      setPasswordForm(emptyPasswordForm);
      Alert.alert(
        t("profile.passwordManagement"),
        t("profile.passwordUpdated"),
      );
    } catch (requestError) {
      Alert.alert(
        t("profile.passwordManagement"),
        requestError instanceof Error
          ? requestError.message
          : String(requestError),
      );
    }
  }

  async function handleRevokeSessions() {
    try {
      await revokeSessionsMutation.mutateAsync();
      Alert.alert(t("profile.sessionSecurity"), t("profile.sessionsRevoked"));
    } catch (error) {
      Alert.alert(
        t("profile.sessionSecurity"),
        error instanceof Error
          ? error.message
          : t("profile.sessionsRevokeFailed"),
      );
    }
  }

  async function handlePreferencesSave() {
    if (!notificationDraft) {
      return;
    }

    try {
      await updatePreferencesMutation.mutateAsync(notificationDraft);
      Alert.alert(t("profile.notifications"), t("profile.preferencesSaved"));
    } catch (requestError) {
      Alert.alert(
        t("profile.notifications"),
        requestError instanceof Error
          ? requestError.message
          : String(requestError),
      );
    }
  }

  async function handleStartTotpEnrollment() {
    try {
      const result = await startTotpEnrollmentMutation.mutateAsync();
      setTotpSecret(result.secret);
      setTotpCode("");
    } catch (requestError) {
      Alert.alert(
        t("profile.mfaTitle"),
        requestError instanceof Error
          ? requestError.message
          : String(requestError),
      );
    }
  }

  async function handleVerifyTotpEnrollment() {
    try {
      await verifyTotpEnrollmentMutation.mutateAsync({
        code: totpCode.trim(),
      });
      setTotpSecret(null);
      setTotpCode("");
      Alert.alert(t("profile.mfaTitle"), t("profile.mfaTotpReady"));
    } catch (requestError) {
      Alert.alert(
        t("profile.mfaTitle"),
        requestError instanceof Error
          ? requestError.message
          : String(requestError),
      );
    }
  }

  async function handleStartEmailEnrollment() {
    try {
      const result = await startEmailEnrollmentMutation.mutateAsync();
      setEmailChallengeId(result.challengeId);
      setEmailCode("");
      setEmailPreviewCode(result.previewCode);
    } catch (requestError) {
      Alert.alert(
        t("profile.mfaTitle"),
        requestError instanceof Error
          ? requestError.message
          : String(requestError),
      );
    }
  }

  async function handleVerifyEmailEnrollment() {
    if (!emailChallengeId) {
      return;
    }

    try {
      await verifyEmailEnrollmentMutation.mutateAsync({
        challengeId: emailChallengeId,
        code: emailCode.trim(),
      });
      setEmailChallengeId(null);
      setEmailCode("");
      setEmailPreviewCode(null);
      Alert.alert(t("profile.mfaTitle"), t("profile.mfaEmailReady"));
    } catch (requestError) {
      Alert.alert(
        t("profile.mfaTitle"),
        requestError instanceof Error
          ? requestError.message
          : String(requestError),
      );
    }
  }

  async function startPasswordStepUp(method: "totp" | "email_otp") {
    try {
      const result = await startMfaChallengeMutation.mutateAsync({
        method,
        purpose: "password_step_up",
      });
      setPasswordChallengeMethod(method);
      setPasswordChallengeId(result.challengeId);
      setPasswordChallengeCode("");
      setPasswordPreviewCode(result.previewCode);
    } catch (requestError) {
      Alert.alert(
        t("profile.passwordManagement"),
        requestError instanceof Error
          ? requestError.message
          : String(requestError),
      );
    }
  }

  async function handleStartEmailRecovery() {
    try {
      const result = await startEmailRecoveryMutation.mutateAsync();
      setRecoveryChallengeId(result.challengeId);
      setRecoveryCode("");
      setRecoveryPreviewCode(result.previewCode);
    } catch (requestError) {
      Alert.alert(
        t("profile.mfaTitle"),
        requestError instanceof Error
          ? requestError.message
          : String(requestError),
      );
    }
  }

  async function handleVerifyEmailRecovery() {
    if (!recoveryChallengeId) {
      return;
    }

    try {
      await verifyEmailRecoveryMutation.mutateAsync({
        challengeId: recoveryChallengeId,
        code: recoveryCode.trim(),
      });
      setRecoveryChallengeId(null);
      setRecoveryCode("");
      setRecoveryPreviewCode(null);
      Alert.alert(t("profile.mfaTitle"), t("profile.mfaRecoveryComplete"));
    } catch (requestError) {
      Alert.alert(
        t("profile.mfaTitle"),
        requestError instanceof Error
          ? requestError.message
          : String(requestError),
      );
    }
  }

  async function handleVerifyPasswordStepUp() {
    if (!passwordChallengeId) {
      return;
    }

    try {
      await verifyMfaChallengeMutation.mutateAsync({
        challengeId: passwordChallengeId,
        method: passwordChallengeMethod,
        purpose: "password_step_up",
        code: passwordChallengeCode.trim(),
      });
      setPasswordChallengeId(null);
      setPasswordChallengeCode("");
      setPasswordPreviewCode(null);
      Alert.alert(t("profile.passwordManagement"), t("profile.mfaStepUpReady"));
    } catch (requestError) {
      Alert.alert(
        t("profile.passwordManagement"),
        requestError instanceof Error
          ? requestError.message
          : String(requestError),
      );
    }
  }

  return (
    <AppScreen
      title={t("profile.title")}
      subtitle={profile?.email}
      trailing={<LanguageToggle />}
    >
      {profileQuery.isError ? (
        <InlineNotice
          message={
            profileQuery.error instanceof Error
              ? profileQuery.error.message
              : t("common.notAvailable")
          }
          tone="critical"
        />
      ) : null}

      {profile ? (
        <>
          <SectionCard className="gap-4">
            <View className="flex-row items-center justify-between">
              <View className="gap-1">
                <AppText className="text-xl text-ink" weight="bold">
                  {t("profile.status")}
                </AppText>
                <AppText className="text-sm text-slate">
                  {profile.firstName} {profile.lastName}
                </AppText>
              </View>
              <StatusChip
                label={formatAccountStatusLabel(profile.accountStatus, locale)}
                tone={getAccountStatusTone(profile.accountStatus)}
              />
            </View>
            <View className="gap-3">
              <AppText className="text-sm text-slate">
                {t("profile.customerId")}
              </AppText>
              <LtrValue
                value={profile.customerId ?? t("common.notAvailable")}
              />
              <AppText className="text-sm text-slate">
                {t("profile.supabaseUserId")}
              </AppText>
              <LtrValue value={profile.supabaseUserId} />
              <AppText className="text-sm text-slate">
                {t("profile.productChainAddress")}
              </AppText>
              <LtrValue value={profile.ethereumAddress} />
            </View>
            <View className="flex-row flex-wrap gap-3">
              {profile.activatedAt ? (
                <SectionCard className="min-w-[45%] flex-1">
                  <AppText className="text-xs text-slate">
                    {t("profile.activatedAt")}
                  </AppText>
                  <AppText className="mt-2 text-sm text-ink" weight="semibold">
                    {formatDateLabel(profile.activatedAt, locale)}
                  </AppText>
                </SectionCard>
              ) : null}
              {profile.restrictedAt ? (
                <SectionCard className="min-w-[45%] flex-1">
                  <AppText className="text-xs text-slate">
                    {t("profile.restrictedAt")}
                  </AppText>
                  <AppText className="mt-2 text-sm text-ink" weight="semibold">
                    {formatDateLabel(profile.restrictedAt, locale)}
                  </AppText>
                </SectionCard>
              ) : null}
            </View>
          </SectionCard>

          <SectionCard className="gap-4">
            <AppText className="text-xl text-ink" weight="bold">
              {t("profile.mfaTitle")}
            </AppText>
            <InlineNotice
              message={
                mfa?.requiresSetup
                  ? t("profile.mfaSetupRequired")
                  : stepUpFresh
                    ? t("profile.mfaStepUpFresh")
                    : t("profile.mfaStepUpRequired")
              }
              tone={mfa?.requiresSetup || !stepUpFresh ? "warning" : "positive"}
            />
            <View className="gap-3">
              <View className="rounded-2xl border border-border bg-white px-4 py-4">
                <AppText className="text-sm text-slate">
                  {t("profile.mfaAuthenticator")}
                </AppText>
                <AppText className="mt-2 text-base text-ink" weight="semibold">
                  {mfa?.totpEnrolled
                    ? t("common.enabled")
                    : t("common.disabled")}
                </AppText>
              </View>
              <View className="rounded-2xl border border-border bg-white px-4 py-4">
                <AppText className="text-sm text-slate">
                  {t("profile.mfaEmailBackup")}
                </AppText>
                <AppText className="mt-2 text-base text-ink" weight="semibold">
                  {mfa?.emailOtpEnrolled
                    ? t("common.enabled")
                    : t("common.disabled")}
                </AppText>
              </View>
            </View>
            {!mfa?.totpEnrolled ? (
              <>
                <AppButton
                  disabled={startTotpEnrollmentMutation.isPending}
                  label={t("profile.mfaStartAuthenticator")}
                  onPress={() => {
                    void handleStartTotpEnrollment();
                  }}
                />
                {totpSecret ? (
                  <View className="gap-3 rounded-2xl border border-border bg-white px-4 py-4">
                    <AppText className="text-sm text-slate">
                      {t("profile.mfaSecretLabel")}
                    </AppText>
                    <LtrValue value={totpSecret} />
                    <FieldInput
                      keyboardType="number-pad"
                      label={t("profile.mfaCodeLabel")}
                      onChangeText={setTotpCode}
                      value={totpCode}
                    />
                    <AppButton
                      disabled={verifyTotpEnrollmentMutation.isPending}
                      label={t("profile.mfaVerifyAuthenticator")}
                      onPress={() => {
                        void handleVerifyTotpEnrollment();
                      }}
                    />
                  </View>
                ) : null}
              </>
            ) : null}
            {mfa?.totpEnrolled && !mfa?.emailOtpEnrolled ? (
              <>
                <AppButton
                  disabled={startEmailEnrollmentMutation.isPending}
                  label={t("profile.mfaStartEmail")}
                  onPress={() => {
                    void handleStartEmailEnrollment();
                  }}
                  variant="secondary"
                />
                {emailChallengeId ? (
                  <View className="gap-3 rounded-2xl border border-border bg-white px-4 py-4">
                    <AppText className="text-sm text-slate">
                      {t("profile.mfaEmailSent")}
                    </AppText>
                    {emailPreviewCode ? (
                      <LtrValue
                        value={`${t("profile.mfaPreviewCode")}: ${emailPreviewCode}`}
                      />
                    ) : null}
                    <FieldInput
                      keyboardType="number-pad"
                      label={t("profile.mfaCodeLabel")}
                      onChangeText={setEmailCode}
                      value={emailCode}
                    />
                    <AppButton
                      disabled={verifyEmailEnrollmentMutation.isPending}
                      label={t("profile.mfaVerifyEmail")}
                      onPress={() => {
                        void handleVerifyEmailEnrollment();
                      }}
                    />
                  </View>
                ) : null}
              </>
            ) : null}
            {mfa?.totpEnrolled && mfa?.emailOtpEnrolled ? (
              <View className="gap-3 rounded-2xl border border-border bg-white px-4 py-4">
                <AppText className="text-sm text-slate">
                  {t("profile.mfaRecoveryDescription")}
                </AppText>
                <AppButton
                  disabled={startEmailRecoveryMutation.isPending}
                  label={t("profile.mfaStartRecovery")}
                  onPress={() => {
                    void handleStartEmailRecovery();
                  }}
                  variant="secondary"
                />
                {recoveryChallengeId ? (
                  <>
                    {recoveryPreviewCode ? (
                      <LtrValue
                        value={`${t("profile.mfaPreviewCode")}: ${recoveryPreviewCode}`}
                      />
                    ) : null}
                    <FieldInput
                      keyboardType="number-pad"
                      label={t("profile.mfaCodeLabel")}
                      onChangeText={setRecoveryCode}
                      value={recoveryCode}
                    />
                    <AppButton
                      disabled={verifyEmailRecoveryMutation.isPending}
                      label={t("profile.mfaVerifyRecovery")}
                      onPress={() => {
                        void handleVerifyEmailRecovery();
                      }}
                    />
                  </>
                ) : null}
              </View>
            ) : null}
            {!mfa?.requiresSetup && !stepUpFresh ? (
              <View className="gap-3 rounded-2xl border border-border bg-white px-4 py-4">
                <AppText className="text-sm text-slate">
                  {t("profile.mfaPasswordStepUp")}
                </AppText>
                <View className="flex-row gap-3">
                  <AppButton
                    fullWidth={false}
                    label={t("profile.mfaUseAuthenticator")}
                    onPress={() => {
                      void startPasswordStepUp("totp");
                    }}
                    variant="secondary"
                  />
                  {mfa?.emailOtpEnrolled ? (
                    <AppButton
                      fullWidth={false}
                      label={t("profile.mfaUseEmail")}
                      onPress={() => {
                        void startPasswordStepUp("email_otp");
                      }}
                      variant="secondary"
                    />
                  ) : null}
                </View>
                {passwordChallengeId ? (
                  <>
                    {passwordPreviewCode ? (
                      <LtrValue
                        value={`${t("profile.mfaPreviewCode")}: ${passwordPreviewCode}`}
                      />
                    ) : null}
                    <FieldInput
                      keyboardType="number-pad"
                      label={t("profile.mfaCodeLabel")}
                      onChangeText={setPasswordChallengeCode}
                      value={passwordChallengeCode}
                    />
                    <AppButton
                      disabled={verifyMfaChallengeMutation.isPending}
                      label={t("profile.mfaVerifyStepUp")}
                      onPress={() => {
                        void handleVerifyPasswordStepUp();
                      }}
                    />
                  </>
                ) : null}
              </View>
            ) : null}
          </SectionCard>

          <SectionCard className="gap-4">
            <AppText className="text-xl text-ink" weight="bold">
              {t("profile.passwordManagement")}
            </AppText>
            {profile.passwordRotationAvailable ? (
              <>
                {!stepUpFresh ? (
                  <InlineNotice
                    message={t("profile.mfaPasswordStepUp")}
                    tone="warning"
                  />
                ) : null}
                <FieldInput
                  label={t("auth.currentPassword")}
                  onChangeText={(value) =>
                    setPasswordForm((current) => ({
                      ...current,
                      currentPassword: value,
                    }))
                  }
                  secureTextEntry
                  value={passwordForm.currentPassword}
                />
                <FieldInput
                  label={t("auth.newPassword")}
                  onChangeText={(value) =>
                    setPasswordForm((current) => ({
                      ...current,
                      newPassword: value,
                    }))
                  }
                  secureTextEntry
                  value={passwordForm.newPassword}
                />
                <FieldInput
                  label={t("auth.confirmPassword")}
                  onChangeText={(value) =>
                    setPasswordForm((current) => ({
                      ...current,
                      confirmPassword: value,
                    }))
                  }
                  secureTextEntry
                  value={passwordForm.confirmPassword}
                />
                <AppButton
                  disabled={rotatePasswordMutation.isPending || !stepUpFresh}
                  label={t("profile.updatePassword")}
                  onPress={() => {
                    void handlePasswordUpdate();
                  }}
                />
              </>
            ) : (
              <InlineNotice message={t("common.notAvailable")} tone="warning" />
            )}
          </SectionCard>

          <SectionCard className="gap-4">
            <AppText className="text-xl text-ink" weight="bold">
              {t("profile.notifications")}
            </AppText>
            {notificationDraft ? (
              <>
                {[
                  { key: "depositEmails", label: t("profile.deposits") },
                  { key: "withdrawalEmails", label: t("profile.withdrawals") },
                  { key: "loanEmails", label: t("profile.loans") },
                  {
                    key: "productUpdateEmails",
                    label: t("profile.productUpdates"),
                  },
                ].map((item) => (
                  <View
                    key={item.key}
                    className="flex-row items-center justify-between rounded-2xl border border-border bg-white px-4 py-4"
                  >
                    <AppText className="text-sm text-ink" weight="semibold">
                      {item.label}
                    </AppText>
                    <Switch
                      accessibilityLabel={item.label}
                      onValueChange={(nextValue) =>
                        setNotificationDraft((current) =>
                          current
                            ? {
                                ...current,
                                [item.key]: nextValue,
                              }
                            : current,
                        )
                      }
                      value={
                        notificationDraft[
                          item.key as keyof typeof notificationDraft
                        ]
                      }
                    />
                  </View>
                ))}
                <AppButton
                  disabled={updatePreferencesMutation.isPending}
                  label={t("profile.savePreferences")}
                  onPress={() => {
                    void handlePreferencesSave();
                  }}
                />
              </>
            ) : (
              <InlineNotice
                message={t("profile.preferencesUnavailable")}
                tone="warning"
              />
            )}
          </SectionCard>

          <SectionCard className="gap-4">
            <AppText className="text-xl text-ink" weight="bold">
              {t("profile.sessionSecurity")}
            </AppText>
            <InlineNotice
              message={t("profile.sessionSecurityDescription")}
              tone="warning"
            />
            <AppButton
              disabled={revokeSessionsMutation.isPending}
              label={t("profile.revokeAllSessions")}
              onPress={() => {
                void handleRevokeSessions();
              }}
              variant="secondary"
            />
          </SectionCard>

          <AppButton
            label={t("common.signOut")}
            onPress={() => {
              void signOut();
            }}
            variant="danger"
          />
        </>
      ) : null}
    </AppScreen>
  );
}
