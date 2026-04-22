import { Alert, Switch, View } from "react-native";
import { useEffect, useState } from "react";
import QRCode from "react-native-qrcode-svg";
import type {
  CustomerNotificationPreferences,
  CustomerSecurityActivityProjection,
  CustomerSessionProjection,
} from "@stealth-trails-bank/types";
import { AppScreen } from "../components/ui/AppScreen";
import { AppButton } from "../components/ui/AppButton";
import { AppText } from "../components/ui/AppText";
import { FieldInput } from "../components/ui/FieldInput";
import { InlineNotice } from "../components/ui/InlineNotice";
import { ScreenHeaderActions } from "../components/ui/ScreenHeaderActions";
import { LtrValue } from "../components/ui/LtrValue";
import { OptionChips } from "../components/ui/OptionChips";
import { SectionCard } from "../components/ui/SectionCard";
import { StatusChip } from "../components/ui/StatusChip";
import {
  useCreateTrustedContactMutation,
  useMfaStatusQuery,
  useCustomerSessionsQuery,
  useCustomerSecurityActivityQuery,
  useProfileQuery,
  useRemoveTrustedContactMutation,
  useRevokeCustomerSessionMutation,
  useRotatePasswordMutation,
  useRevokeAllCustomerSessionsMutation,
  useStartSessionTrustChallengeMutation,
  useStartEmailEnrollmentMutation,
  useStartEmailRecoveryMutation,
  useStartMfaChallengeMutation,
  useStartTotpEnrollmentMutation,
  useUpdateCustomerAgeProfileMutation,
  useUpdateNotificationPreferencesMutation,
  useUpdateTrustedContactMutation,
  useVerifyEmailEnrollmentMutation,
  useVerifyEmailRecoveryMutation,
  useVerifyMfaChallengeMutation,
  useVerifySessionTrustMutation,
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

type TrustedContactDraft = {
  kind: "trusted_contact" | "beneficiary";
  firstName: string;
  lastName: string;
  relationshipLabel: string;
  email: string;
  phoneNumber: string;
  note: string;
};

const emptyTrustedContactDraft = {
  kind: "trusted_contact" as const,
  firstName: "",
  lastName: "",
  relationshipLabel: "",
  email: "",
  phoneNumber: "",
  note: "",
};

const recommendedAuthenticatorApps = [
  "Google Authenticator",
  "Microsoft Authenticator",
];

const buildNotificationToggleItems = (t: ReturnType<typeof useT>) =>
  [
    { key: "depositEmails", label: t("profile.deposits") },
    { key: "withdrawalEmails", label: t("profile.withdrawals") },
    { key: "loanEmails", label: t("profile.loans") },
    {
      key: "productUpdateEmails",
      label: t("profile.productUpdates"),
    },
  ] as const;

function formatSessionLabel(
  session: CustomerSessionProjection,
  t: ReturnType<typeof useT>,
) {
  if (session.clientPlatform === "mobile") {
    return t("profile.sessionPlatformMobile");
  }

  if (session.clientPlatform === "web") {
    return t("profile.sessionPlatformWeb");
  }

  return t("profile.sessionPlatformUnknown");
}

function formatSecurityActivityTitle(
  event: CustomerSecurityActivityProjection,
  t: ReturnType<typeof useT>,
) {
  switch (event.kind) {
    case "login":
      return t("profile.securityActivityLogin");
    case "session_revoked":
      return t("profile.securityActivitySessionRevoked");
    case "sessions_revoked":
      return t("profile.securityActivitySessionsRevoked");
    case "password_rotated":
      return t("profile.securityActivityPasswordRotated");
    case "mfa_authenticator_enrolled":
      return t("profile.securityActivityMfaAuthenticatorEnrolled");
    case "mfa_email_backup_enrolled":
      return t("profile.securityActivityMfaEmailEnrolled");
    case "mfa_recovery_completed":
      return t("profile.securityActivityMfaRecovery");
    case "mfa_step_up_verified":
      return t("profile.securityActivityMfaVerified");
    case "session_trust_verified":
      return t("profile.securityActivitySessionVerified");
  }
}

function formatSecurityActivityDetail(
  event: CustomerSecurityActivityProjection,
  t: ReturnType<typeof useT>,
) {
  if (event.kind === "login") {
    if (event.clientPlatform === "web") {
      return t("profile.securityActivityLoginWeb");
    }

    if (event.clientPlatform === "mobile") {
      return t("profile.securityActivityLoginMobile");
    }

    return t("profile.securityActivityLoginUnknown");
  }

  if (event.kind === "mfa_step_up_verified") {
    if (event.purpose === "withdrawal_step_up") {
      return t("profile.securityActivityStepUpWithdrawal");
    }

    if (event.purpose === "password_step_up") {
      return t("profile.securityActivityStepUpPassword");
    }
  }

  if (event.kind === "session_trust_verified") {
    return t("profile.securityActivitySessionVerifiedDetail");
  }

  return null;
}

function formatAgeVerificationStatusLabel(
  status: "unverified" | "self_attested" | "verified" | "rejected",
) {
  switch (status) {
    case "verified":
      return "Operator verified";
    case "self_attested":
      return "Self attested";
    case "rejected":
      return "Verification rejected";
    case "unverified":
      return "Not verified";
  }
}

function formatTrustedContactKindLabel(
  kind: "trusted_contact" | "beneficiary",
) {
  return kind === "beneficiary" ? "Beneficiary" : "Trusted contact";
}

export function ProfileScreen() {
  const t = useT();
  const { locale } = useLocale();
  const profileQuery = useProfileQuery();
  useMfaStatusQuery();
  const customerSessionsQuery = useCustomerSessionsQuery();
  const securityActivityQuery = useCustomerSecurityActivityQuery();
  const signOut = useSessionStore((state) => state.signOut);
  const sessionUser = useSessionStore((state) => state.user);
  const rotatePasswordMutation = useRotatePasswordMutation();
  const revokeSessionsMutation = useRevokeAllCustomerSessionsMutation();
  const revokeCustomerSessionMutation = useRevokeCustomerSessionMutation();
  const startSessionTrustChallengeMutation =
    useStartSessionTrustChallengeMutation();
  const verifySessionTrustMutation = useVerifySessionTrustMutation();
  const updatePreferencesMutation = useUpdateNotificationPreferencesMutation();
  const updateAgeProfileMutation = useUpdateCustomerAgeProfileMutation();
  const createTrustedContactMutation = useCreateTrustedContactMutation();
  const updateTrustedContactMutation = useUpdateTrustedContactMutation();
  const removeTrustedContactMutation = useRemoveTrustedContactMutation();
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
  const sessionSecurity =
    profile?.sessionSecurity ?? sessionUser?.sessionSecurity;
  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
  const [notificationDraft, setNotificationDraft] =
    useState<CustomerNotificationPreferences | null>(null);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [totpOtpAuthUri, setTotpOtpAuthUri] = useState<string | null>(null);
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
  const [sessionTrustCode, setSessionTrustCode] = useState("");
  const [sessionTrustPreviewCode, setSessionTrustPreviewCode] = useState<
    string | null
  >(null);
  const [ageDateOfBirthDraft, setAgeDateOfBirthDraft] = useState("");
  const [trustedContactDraft, setTrustedContactDraft] =
    useState<TrustedContactDraft>(emptyTrustedContactDraft);
  const [editingTrustedContactId, setEditingTrustedContactId] = useState<
    string | null
  >(null);

  useEffect(() => {
    setNotificationDraft(profile?.notificationPreferences ?? null);
  }, [profile?.notificationPreferences]);

  useEffect(() => {
    setAgeDateOfBirthDraft(profile?.ageProfile?.dateOfBirth ?? "");
  }, [profile?.ageProfile?.dateOfBirth]);

  const stepUpFresh =
    Boolean(mfa?.stepUpFreshUntil) &&
    Date.parse(mfa?.stepUpFreshUntil ?? "") > Date.now();
  const ageProfile = profile?.ageProfile ?? null;
  const trustedContacts = profile?.trustedContacts ?? [];
  const customerSessions = customerSessionsQuery.data?.sessions ?? [];
  const securityActivity = securityActivityQuery.data?.events ?? [];

  async function handlePasswordUpdate() {
    if (sessionSecurity?.currentSessionRequiresVerification) {
      Alert.alert(
        t("profile.passwordManagement"),
        t("profile.sessionVerificationRequired"),
      );
      return;
    }

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

  async function handleStartSessionTrustChallenge() {
    try {
      const result = await startSessionTrustChallengeMutation.mutateAsync();
      setSessionTrustCode("");
      setSessionTrustPreviewCode(result.previewCode);
      Alert.alert(
        t("profile.sessionSecurity"),
        t("profile.sessionTrustCodeSent"),
      );
    } catch (error) {
      Alert.alert(
        t("profile.sessionSecurity"),
        error instanceof Error ? error.message : t("common.notAvailable"),
      );
    }
  }

  async function handleVerifySessionTrust() {
    try {
      await verifySessionTrustMutation.mutateAsync(sessionTrustCode.trim());
      setSessionTrustCode("");
      setSessionTrustPreviewCode(null);
      Alert.alert(
        t("profile.sessionSecurity"),
        t("profile.sessionTrustVerified"),
      );
    } catch (error) {
      Alert.alert(
        t("profile.sessionSecurity"),
        error instanceof Error ? error.message : t("common.notAvailable"),
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

  async function handleRevokeSession(sessionId: string) {
    try {
      await revokeCustomerSessionMutation.mutateAsync(sessionId);
      Alert.alert(t("profile.sessionSecurity"), t("profile.sessionRevoked"));
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

  async function handleAgeProfileSave() {
    try {
      await updateAgeProfileMutation.mutateAsync({
        dateOfBirth: ageDateOfBirthDraft.trim() || null,
      });
      Alert.alert(
        "Age foundation",
        ageDateOfBirthDraft.trim()
          ? "Date of birth saved as a self-attested age record."
          : "Age record cleared.",
      );
    } catch (requestError) {
      Alert.alert(
        "Age foundation",
        requestError instanceof Error
          ? requestError.message
          : String(requestError),
      );
    }
  }

  async function handleTrustedContactSave() {
    try {
      if (editingTrustedContactId) {
        await updateTrustedContactMutation.mutateAsync({
          contactId: editingTrustedContactId,
          ...trustedContactDraft,
        });
        Alert.alert("Trusted contacts", "Trusted contact updated.");
      } else {
        await createTrustedContactMutation.mutateAsync(trustedContactDraft);
        Alert.alert("Trusted contacts", "Trusted contact added.");
      }

      setTrustedContactDraft(emptyTrustedContactDraft);
      setEditingTrustedContactId(null);
    } catch (requestError) {
      Alert.alert(
        "Trusted contacts",
        requestError instanceof Error
          ? requestError.message
          : String(requestError),
      );
    }
  }

  async function handleTrustedContactRemove(contactId: string) {
    try {
      await removeTrustedContactMutation.mutateAsync(contactId);
      if (editingTrustedContactId === contactId) {
        setEditingTrustedContactId(null);
        setTrustedContactDraft(emptyTrustedContactDraft);
      }
      Alert.alert("Trusted contacts", "Trusted contact removed.");
    } catch (requestError) {
      Alert.alert(
        "Trusted contacts",
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
      setTotpOtpAuthUri(result.otpAuthUri);
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
      setTotpOtpAuthUri(null);
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
      trailing={<ScreenHeaderActions />}
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
                {!mfa?.totpEnrolled ? (
                  <AppText className="mt-3 text-sm text-slate">
                    {t("profile.mfaRecommendedApps", {
                      first: recommendedAuthenticatorApps[0],
                      second: recommendedAuthenticatorApps[1],
                    })}
                  </AppText>
                ) : null}
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
                      {t("profile.mfaCompatibleApps")}
                    </AppText>
                    {totpOtpAuthUri ? (
                      <View className="items-center rounded-2xl border border-border bg-white py-4">
                        <QRCode value={totpOtpAuthUri} size={168} />
                      </View>
                    ) : null}
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
                {buildNotificationToggleItems(t).map((item) => (
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
                        notificationDraft[item.key]
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
              Age foundation
            </AppText>
            <InlineNotice
              message="This date-of-birth record prepares age-based vault rules and operator verification. Customer edits remain self-attested until reviewed."
              tone="neutral"
            />
            {profile.customerId ? (
              <>
                <View className="flex-row flex-wrap gap-3">
                  <SectionCard className="min-w-[45%] flex-1">
                    <AppText className="text-xs text-slate">
                      Verification status
                    </AppText>
                    <AppText
                      className="mt-2 text-sm text-ink"
                      weight="semibold"
                    >
                      {formatAgeVerificationStatusLabel(
                        ageProfile?.verificationStatus ?? "unverified",
                      )}
                    </AppText>
                  </SectionCard>
                  <SectionCard className="min-w-[45%] flex-1">
                    <AppText className="text-xs text-slate">
                      Derived age
                    </AppText>
                    <AppText
                      className="mt-2 text-sm text-ink"
                      weight="semibold"
                    >
                      {ageProfile?.ageYears ?? "Not recorded"}
                    </AppText>
                  </SectionCard>
                  <SectionCard className="min-w-[45%] flex-1">
                    <AppText className="text-xs text-slate">
                      Adult threshold
                    </AppText>
                    <AppText
                      className="mt-2 text-sm text-ink"
                      weight="semibold"
                    >
                      {ageProfile?.legalAdult == null
                        ? "Not yet determined"
                        : ageProfile.legalAdult
                          ? "18+ from DOB"
                          : "Under 18 from DOB"}
                    </AppText>
                  </SectionCard>
                </View>
                {ageProfile?.verificationNote ? (
                  <InlineNotice
                    message={ageProfile.verificationNote}
                    tone="neutral"
                  />
                ) : null}
                <FieldInput
                  label="Date of birth"
                  helper="Use YYYY-MM-DD."
                  onChangeText={setAgeDateOfBirthDraft}
                  value={ageDateOfBirthDraft}
                />
                <View className="gap-3">
                  <AppButton
                    disabled={updateAgeProfileMutation.isPending}
                    label="Save date of birth"
                    onPress={() => {
                      void handleAgeProfileSave();
                    }}
                  />
                  <AppButton
                    disabled={
                      updateAgeProfileMutation.isPending || !ageDateOfBirthDraft
                    }
                    label="Clear draft"
                    onPress={() => {
                      setAgeDateOfBirthDraft("");
                    }}
                    variant="secondary"
                  />
                </View>
              </>
            ) : (
              <InlineNotice
                message="Legacy-only records do not yet expose managed customer age data from this portal."
                tone="warning"
              />
            )}
          </SectionCard>

          <SectionCard className="gap-4">
            <AppText className="text-xl text-ink" weight="bold">
              Trusted contacts
            </AppText>
            <InlineNotice
              message="These records prepare future vault beneficiary and dual-approval flows. They do not create release rights on their own today."
              tone="neutral"
            />
            {profile.customerId ? (
              <>
                {trustedContacts.length > 0 ? (
                  trustedContacts.map((contact) => (
                    <View
                      key={contact.id}
                      className="gap-3 rounded-2xl border border-border bg-white px-4 py-4"
                    >
                      <View className="gap-1">
                        <AppText
                          className="text-base text-ink"
                          weight="semibold"
                        >
                          {contact.firstName} {contact.lastName}
                        </AppText>
                        <AppText className="text-sm text-slate">
                          {formatTrustedContactKindLabel(contact.kind)} •{" "}
                          {contact.relationshipLabel}
                        </AppText>
                        {contact.email ? (
                          <LtrValue value={contact.email} />
                        ) : null}
                        {contact.phoneNumber ? (
                          <LtrValue value={contact.phoneNumber} />
                        ) : null}
                        {contact.note ? (
                          <AppText className="text-sm text-slate">
                            {contact.note}
                          </AppText>
                        ) : null}
                      </View>
                      <View className="flex-row gap-3">
                        <AppButton
                          fullWidth={false}
                          label="Edit"
                          onPress={() => {
                            setEditingTrustedContactId(contact.id);
                            setTrustedContactDraft({
                              kind: contact.kind,
                              firstName: contact.firstName,
                              lastName: contact.lastName,
                              relationshipLabel: contact.relationshipLabel,
                              email: contact.email ?? "",
                              phoneNumber: contact.phoneNumber ?? "",
                              note: contact.note ?? "",
                            });
                          }}
                          variant="secondary"
                        />
                        <AppButton
                          disabled={removeTrustedContactMutation.isPending}
                          fullWidth={false}
                          label="Remove"
                          onPress={() => {
                            void handleTrustedContactRemove(contact.id);
                          }}
                          variant="secondary"
                        />
                      </View>
                    </View>
                  ))
                ) : (
                  <InlineNotice
                    message="No trusted contacts are recorded yet."
                    tone="neutral"
                  />
                )}

                <View className="gap-3 rounded-2xl border border-border bg-white px-4 py-4">
                  <AppText className="text-base text-ink" weight="semibold">
                    {editingTrustedContactId
                      ? "Edit trusted contact"
                      : "Add trusted contact"}
                  </AppText>
                  <OptionChips
                    options={[
                      { label: "Trusted contact", value: "trusted_contact" },
                      { label: "Beneficiary", value: "beneficiary" },
                    ]}
                    value={trustedContactDraft.kind}
                    onChange={(value) =>
                      setTrustedContactDraft((current) => ({
                        ...current,
                        kind: value as "trusted_contact" | "beneficiary",
                      }))
                    }
                  />
                  <FieldInput
                    label="First name"
                    onChangeText={(value) =>
                      setTrustedContactDraft((current) => ({
                        ...current,
                        firstName: value,
                      }))
                    }
                    value={trustedContactDraft.firstName}
                  />
                  <FieldInput
                    label="Last name"
                    onChangeText={(value) =>
                      setTrustedContactDraft((current) => ({
                        ...current,
                        lastName: value,
                      }))
                    }
                    value={trustedContactDraft.lastName}
                  />
                  <FieldInput
                    label="Relationship"
                    onChangeText={(value) =>
                      setTrustedContactDraft((current) => ({
                        ...current,
                        relationshipLabel: value,
                      }))
                    }
                    value={trustedContactDraft.relationshipLabel}
                  />
                  <FieldInput
                    label="Email"
                    onChangeText={(value) =>
                      setTrustedContactDraft((current) => ({
                        ...current,
                        email: value,
                      }))
                    }
                    value={trustedContactDraft.email}
                  />
                  <FieldInput
                    label="Phone number"
                    onChangeText={(value) =>
                      setTrustedContactDraft((current) => ({
                        ...current,
                        phoneNumber: value,
                      }))
                    }
                    value={trustedContactDraft.phoneNumber}
                  />
                  <FieldInput
                    label="Note"
                    onChangeText={(value) =>
                      setTrustedContactDraft((current) => ({
                        ...current,
                        note: value,
                      }))
                    }
                    value={trustedContactDraft.note}
                  />
                  <AppButton
                    disabled={
                      createTrustedContactMutation.isPending ||
                      updateTrustedContactMutation.isPending
                    }
                    label={
                      editingTrustedContactId
                        ? "Update trusted contact"
                        : "Add trusted contact"
                    }
                    onPress={() => {
                      void handleTrustedContactSave();
                    }}
                  />
                  {editingTrustedContactId ? (
                    <AppButton
                      label="Cancel editing"
                      onPress={() => {
                        setEditingTrustedContactId(null);
                        setTrustedContactDraft(emptyTrustedContactDraft);
                      }}
                      variant="secondary"
                    />
                  ) : null}
                </View>
              </>
            ) : (
              <InlineNotice
                message="Legacy-only records do not yet expose managed customer contact governance from this portal."
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
            <InlineNotice
              message={
                sessionSecurity?.currentSessionRequiresVerification
                  ? t("profile.sessionVerificationRequired")
                  : t("profile.sessionTrusted")
              }
              tone={
                sessionSecurity?.currentSessionRequiresVerification
                  ? "critical"
                  : "positive"
              }
            />
            {sessionSecurity?.currentSessionRequiresVerification ? (
              <View className="gap-3 rounded-2xl border border-border bg-white px-4 py-4">
                <AppButton
                  disabled={startSessionTrustChallengeMutation.isPending}
                  label={t("profile.sessionTrustStart")}
                  onPress={() => {
                    void handleStartSessionTrustChallenge();
                  }}
                  variant="secondary"
                />
                <FieldInput
                  keyboardType="number-pad"
                  label={t("profile.mfaCodeLabel")}
                  maxLength={6}
                  onChangeText={setSessionTrustCode}
                  value={sessionTrustCode}
                />
                {sessionTrustPreviewCode ? (
                  <View className="gap-1">
                    <AppText className="text-sm text-slate">
                      {t("profile.mfaPreviewCode")}
                    </AppText>
                    <LtrValue value={sessionTrustPreviewCode} />
                  </View>
                ) : null}
                <AppButton
                  disabled={
                    verifySessionTrustMutation.isPending ||
                    sessionTrustCode.trim().length !== 6
                  }
                  label={t("profile.sessionTrustVerify")}
                  onPress={() => {
                    void handleVerifySessionTrust();
                  }}
                />
              </View>
            ) : null}
            <AppButton
              disabled={revokeSessionsMutation.isPending}
              label={t("profile.revokeAllSessions")}
              onPress={() => {
                void handleRevokeSessions();
              }}
              variant="secondary"
            />
            <View className="gap-3">
              <AppText className="text-sm text-slate">
                {t("profile.activeSessions")}
              </AppText>
              {customerSessionsQuery.isLoading ? (
                <InlineNotice
                  message={t("profile.sessionsLoading")}
                  tone="neutral"
                />
              ) : customerSessionsQuery.isError ? (
                <InlineNotice
                  message={
                    customerSessionsQuery.error instanceof Error
                      ? customerSessionsQuery.error.message
                      : t("profile.sessionsUnavailable")
                  }
                  tone="critical"
                />
              ) : customerSessions.length > 0 ? (
                customerSessions.map((session) => (
                  <View
                    key={session.id}
                    className="gap-3 rounded-2xl border border-border bg-white px-4 py-4"
                  >
                    <View className="flex-row items-center justify-between gap-3">
                      <View className="flex-1 gap-1">
                        <AppText
                          className="text-base text-ink"
                          weight="semibold"
                        >
                          {formatSessionLabel(session, t)}
                        </AppText>
                        <AppText className="text-sm text-slate">
                          {t("profile.sessionLastSeen")}{" "}
                          {formatDateLabel(session.lastSeenAt, locale)}
                        </AppText>
                        {session.ipAddress ? (
                          <LtrValue value={`IP ${session.ipAddress}`} />
                        ) : null}
                        {session.userAgent ? (
                          <AppText className="text-xs text-slate">
                            {session.userAgent}
                          </AppText>
                        ) : null}
                      </View>
                      {session.current ? (
                        <StatusChip
                          label={t("profile.currentSession")}
                          tone="positive"
                        />
                      ) : (
                        <StatusChip
                          label={
                            session.trusted
                              ? t("profile.trustedSession")
                              : t("profile.verifySessionBadge")
                          }
                          tone={session.trusted ? "neutral" : "warning"}
                        />
                      )}
                    </View>
                    {!session.current ? (
                      <AppButton
                        disabled={revokeCustomerSessionMutation.isPending}
                        label={t("profile.revokeSession")}
                        onPress={() => {
                          void handleRevokeSession(session.id);
                        }}
                        variant="secondary"
                      />
                    ) : null}
                  </View>
                ))
              ) : (
                <InlineNotice
                  message={t("profile.noActiveSessions")}
                  tone="neutral"
                />
              )}
            </View>
            <View className="gap-3">
              <AppText className="text-sm text-slate">
                {t("profile.securityActivity")}
              </AppText>
              {securityActivityQuery.isLoading ? (
                <InlineNotice
                  message={t("profile.securityActivityLoading")}
                  tone="neutral"
                />
              ) : securityActivityQuery.isError ? (
                <InlineNotice
                  message={
                    securityActivityQuery.error instanceof Error
                      ? securityActivityQuery.error.message
                      : t("profile.securityActivityUnavailable")
                  }
                  tone="critical"
                />
              ) : securityActivity.length > 0 ? (
                securityActivity.map((event) => (
                  <View
                    key={event.id}
                    className="gap-2 rounded-2xl border border-border bg-white px-4 py-4"
                  >
                    <AppText className="text-base text-ink" weight="semibold">
                      {formatSecurityActivityTitle(event, t)}
                    </AppText>
                    <AppText className="text-sm text-slate">
                      {formatDateLabel(event.createdAt, locale)}
                    </AppText>
                    {formatSecurityActivityDetail(event, t) ? (
                      <AppText className="text-sm text-slate">
                        {formatSecurityActivityDetail(event, t)}
                      </AppText>
                    ) : null}
                    {event.ipAddress ? (
                      <LtrValue value={`IP ${event.ipAddress}`} />
                    ) : null}
                    {event.userAgent ? (
                      <AppText className="text-xs text-slate">
                        {event.userAgent}
                      </AppText>
                    ) : null}
                  </View>
                ))
              ) : (
                <InlineNotice
                  message={t("profile.securityActivityEmpty")}
                  tone="neutral"
                />
              )}
            </View>
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
