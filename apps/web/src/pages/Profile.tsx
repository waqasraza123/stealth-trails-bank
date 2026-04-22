import { useEffect, useState } from "react";
import type {
  CustomerTrustedContactProjection,
  CustomerNotificationPreferences,
  CustomerSecurityActivityProjection,
  CustomerSessionProjection,
} from "@stealth-trails-bank/types";
import { QRCodeSVG } from "qrcode.react";
import { Layout } from "@/components/Layout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  MonitorSmartphone,
  CheckCircle2,
  Loader2,
  LogOut,
  Mail,
  Shield,
  ShieldAlert,
  UserRound,
  Wallet,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLocale } from "@/i18n/use-locale";
import { useT } from "@/i18n/use-t";
import {
  useListCustomerSessions,
  useListCustomerSecurityActivity,
  useRevokeCustomerSession,
  useRevokeAllSessions,
  useStartCurrentSessionTrustChallenge,
  useCreateTrustedContact,
  useRemoveTrustedContact,
  useRotatePassword,
  useUpdateCustomerAgeProfile,
  useUpdateNotificationPreferences,
  useUpdateTrustedContact,
  useVerifyCurrentSessionTrust,
} from "@/hooks/user/useProfileSettings";
import {
  useCustomerMfaStatus,
  useStartEmailRecovery,
  useStartCustomerMfaChallenge,
  useStartEmailEnrollment,
  useStartTotpEnrollment,
  useVerifyCustomerMfaChallenge,
  useVerifyEmailRecovery,
  useVerifyEmailEnrollment,
  useVerifyTotpEnrollment,
} from "@/hooks/auth/useCustomerMfa";
import { useGetUser } from "@/hooks/user/useGetUser";
import {
  formatAccountStatusLabel,
  getAccountLifecycleEntries,
  getAccountStatusBadgeTone,
  getAccountStatusSummary,
} from "@/lib/customer-account";
import { formatDateLabel } from "@/lib/customer-finance";
import { useUserStore } from "@/stores/userStore";

const emptyPasswordForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
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

function sameNotificationPreferences(
  left: CustomerNotificationPreferences | null,
  right: CustomerNotificationPreferences | null,
): boolean {
  const normalizedLeft = coerceNotificationPreferences(left);
  const normalizedRight = coerceNotificationPreferences(right);

  if (!normalizedLeft || !normalizedRight) {
    return normalizedLeft === normalizedRight;
  }

  return JSON.stringify(normalizedLeft) === JSON.stringify(normalizedRight);
}

const notificationCategoryLabels: Record<
  CustomerNotificationPreferences["entries"][number]["category"],
  string
> = {
  security: "Security",
  money_movement: "Money movement",
  yield: "Yield",
  vault: "Retirement vault",
  loans: "Loans",
  account: "Account",
  governance: "Governance",
  operations: "Operations",
  incident: "Incident",
  product: "Product",
};

const notificationChannelLabels = {
  in_app: "In app",
  email: "Email",
  push: "Push",
} as const;

function coerceNotificationPreferences(
  value: CustomerNotificationPreferences | null | undefined,
): CustomerNotificationPreferences | null {
  if (!value) {
    return null;
  }

  if (Array.isArray((value as { entries?: unknown }).entries)) {
    return value;
  }

  const legacyValue = value as Record<string, unknown>;
  const moneyMovementEmail =
    legacyValue.depositEmails === true || legacyValue.withdrawalEmails === true;

  return {
    audience: "customer",
    supportedChannels: ["in_app", "email"],
    updatedAt: null,
    entries: [
      {
        category: "security",
        channels: [
          { channel: "in_app", enabled: true, mandatory: true },
          { channel: "email", enabled: true, mandatory: true },
        ],
      },
      {
        category: "money_movement",
        channels: [
          { channel: "in_app", enabled: true, mandatory: false },
          { channel: "email", enabled: moneyMovementEmail, mandatory: false },
        ],
      },
      {
        category: "yield",
        channels: [
          { channel: "in_app", enabled: true, mandatory: false },
          { channel: "email", enabled: true, mandatory: false },
        ],
      },
      {
        category: "vault",
        channels: [
          { channel: "in_app", enabled: true, mandatory: false },
          { channel: "email", enabled: true, mandatory: false },
        ],
      },
      {
        category: "loans",
        channels: [
          { channel: "in_app", enabled: true, mandatory: false },
          { channel: "email", enabled: legacyValue.loanEmails !== false, mandatory: false },
        ],
      },
      {
        category: "account",
        channels: [
          { channel: "in_app", enabled: true, mandatory: false },
          { channel: "email", enabled: true, mandatory: false },
        ],
      },
      {
        category: "governance",
        channels: [
          { channel: "in_app", enabled: true, mandatory: false },
          { channel: "email", enabled: false, mandatory: false },
        ],
      },
      {
        category: "operations",
        channels: [
          { channel: "in_app", enabled: true, mandatory: false },
          { channel: "email", enabled: false, mandatory: false },
        ],
      },
      {
        category: "incident",
        channels: [
          { channel: "in_app", enabled: true, mandatory: false },
          { channel: "email", enabled: false, mandatory: false },
        ],
      },
      {
        category: "product",
        channels: [
          { channel: "in_app", enabled: true, mandatory: false },
          {
            channel: "email",
            enabled: legacyValue.productUpdateEmails === true,
            mandatory: false,
          },
        ],
      },
    ],
  };
}

function formatSessionLabel(session: CustomerSessionProjection): string {
  if (session.clientPlatform === "mobile") {
    return "Mobile app";
  }

  if (session.clientPlatform === "web") {
    return "Web browser";
  }

  return "Unknown client";
}

function formatSecurityActivityTitle(
  event: CustomerSecurityActivityProjection,
): string {
  switch (event.kind) {
    case "login":
      return "New sign-in";
    case "session_revoked":
      return "Session revoked";
    case "sessions_revoked":
      return "Other sessions revoked";
    case "password_rotated":
      return "Password changed";
    case "mfa_authenticator_enrolled":
      return "Authenticator enrolled";
    case "mfa_email_backup_enrolled":
      return "Email backup enrolled";
    case "mfa_recovery_completed":
      return "Authenticator recovered";
    case "mfa_step_up_verified":
      return "MFA challenge verified";
    case "session_trust_verified":
      return "Session verified";
  }
}

function formatSecurityActivityDetail(
  event: CustomerSecurityActivityProjection,
): string | null {
  if (event.kind === "login") {
    if (event.clientPlatform === "web") {
      return "Web browser session started.";
    }

    if (event.clientPlatform === "mobile") {
      return "Mobile app session started.";
    }

    return "A new customer session started.";
  }

  if (event.kind === "mfa_step_up_verified") {
    if (event.purpose === "withdrawal_step_up") {
      return "Verified for money movement.";
    }

    if (event.purpose === "password_step_up") {
      return "Verified for password change.";
    }
  }

  if (event.kind === "session_trust_verified") {
    return "This session was verified for sensitive actions.";
  }

  return null;
}

function formatAgeVerificationStatusLabel(
  status: "unverified" | "self_attested" | "verified" | "rejected",
): string {
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
): string {
  return kind === "beneficiary" ? "Beneficiary" : "Trusted contact";
}

function toTrustedContactDraft(
  contact?: CustomerTrustedContactProjection,
): typeof emptyTrustedContactDraft {
  if (!contact) {
    return emptyTrustedContactDraft;
  }

  return {
    kind: contact.kind,
    firstName: contact.firstName,
    lastName: contact.lastName,
    relationshipLabel: contact.relationshipLabel,
    email: contact.email ?? "",
    phoneNumber: contact.phoneNumber ?? "",
    note: contact.note ?? "",
  };
}

const Profile = () => {
  const t = useT();
  const { locale } = useLocale();
  const navigate = useNavigate();
  const userFromStore = useUserStore((state) => state.user);
  const clearUser = useUserStore((state) => state.clearUser);
  const profileQuery = useGetUser(userFromStore?.supabaseUserId);
  const rotatePasswordMutation = useRotatePassword();
  const revokeAllSessionsMutation = useRevokeAllSessions();
  const customerSessionsQuery = useListCustomerSessions();
  const securityActivityQuery = useListCustomerSecurityActivity();
  const revokeCustomerSessionMutation = useRevokeCustomerSession();
  const startSessionTrustChallengeMutation =
    useStartCurrentSessionTrustChallenge();
  const verifyCurrentSessionTrustMutation = useVerifyCurrentSessionTrust();
  const updateNotificationPreferencesMutation =
    useUpdateNotificationPreferences();
  const updateCustomerAgeProfileMutation = useUpdateCustomerAgeProfile();
  const createTrustedContactMutation = useCreateTrustedContact();
  const updateTrustedContactMutation = useUpdateTrustedContact();
  const removeTrustedContactMutation = useRemoveTrustedContact();
  useCustomerMfaStatus();
  const startTotpEnrollment = useStartTotpEnrollment();
  const verifyTotpEnrollment = useVerifyTotpEnrollment();
  const startEmailEnrollment = useStartEmailEnrollment();
  const verifyEmailEnrollment = useVerifyEmailEnrollment();
  const startEmailRecovery = useStartEmailRecovery();
  const verifyEmailRecovery = useVerifyEmailRecovery();
  const startMfaChallenge = useStartCustomerMfaChallenge();
  const verifyMfaChallenge = useVerifyCustomerMfaChallenge();
  const profile = profileQuery.data;
  const mfa = profile?.mfa ?? userFromStore?.mfa;

  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionTrustCode, setSessionTrustCode] = useState("");
  const [sessionTrustPreviewCode, setSessionTrustPreviewCode] = useState<
    string | null
  >(null);
  const [notificationDraft, setNotificationDraft] =
    useState<CustomerNotificationPreferences | null>(null);
  const [notificationNotice, setNotificationNotice] = useState<string | null>(
    null,
  );
  const [notificationError, setNotificationError] = useState<string | null>(
    null,
  );
  const [ageDateOfBirthDraft, setAgeDateOfBirthDraft] = useState("");
  const [ageNotice, setAgeNotice] = useState<string | null>(null);
  const [ageError, setAgeError] = useState<string | null>(null);
  const [trustedContactDraft, setTrustedContactDraft] = useState(
    emptyTrustedContactDraft,
  );
  const [editingTrustedContactId, setEditingTrustedContactId] = useState<
    string | null
  >(null);
  const [trustedContactNotice, setTrustedContactNotice] = useState<
    string | null
  >(null);
  const [trustedContactError, setTrustedContactError] = useState<string | null>(
    null,
  );
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

  useEffect(() => {
    setNotificationDraft(coerceNotificationPreferences(profile?.notificationPreferences));
  }, [profile?.notificationPreferences]);

  useEffect(() => {
    setAgeDateOfBirthDraft(profile?.ageProfile?.dateOfBirth ?? "");
  }, [profile?.ageProfile?.dateOfBirth]);

  const handleLogout = () => {
    clearUser();
    navigate("/auth/sign-in");
  };

  if (profileQuery.isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-mint-600" />
      </div>
    );
  }

  const fullName =
    [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") ||
    [userFromStore?.firstName, userFromStore?.lastName]
      .filter(Boolean)
      .join(" ") ||
    t("profile.customerFallback");
  const lifecycleEntries = profile
    ? getAccountLifecycleEntries(profile, locale)
    : [];
  const passwordRotationAvailable = profile?.passwordRotationAvailable ?? false;
  const sessionSecurity =
    profile?.sessionSecurity ?? userFromStore?.sessionSecurity;
  const stepUpFresh =
    Boolean(mfa?.stepUpFreshUntil) &&
    Date.parse(mfa?.stepUpFreshUntil ?? "") > Date.now();
  const notificationPreferencesAvailable =
    profile?.notificationPreferences !== null &&
    typeof profile?.notificationPreferences !== "undefined";
  const notificationPreferencesChanged = !sameNotificationPreferences(
    notificationDraft,
    profile?.notificationPreferences ?? null,
  );
  const ageProfile = profile?.ageProfile ?? null;
  const ageProfileChanged =
    ageDateOfBirthDraft !== (ageProfile?.dateOfBirth ?? "");
  const trustedContacts = profile?.trustedContacts ?? [];
  const customerSessions = customerSessionsQuery.data?.sessions ?? [];
  const securityActivity = securityActivityQuery.data?.events ?? [];

  async function handlePasswordSubmit() {
    setPasswordNotice(null);
    setPasswordError(null);

    if (!stepUpFresh) {
      setPasswordError("Verify MFA before updating the password.");
      return;
    }

    if (sessionSecurity?.currentSessionRequiresVerification) {
      setPasswordError(
        "Verify this unfamiliar session before changing the password.",
      );
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("Confirm password must match the new password.");
      return;
    }

    try {
      await rotatePasswordMutation.mutateAsync({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm(emptyPasswordForm);
      setPasswordNotice("Password updated successfully.");
    } catch (error) {
      setPasswordError(
        error instanceof Error ? error.message : "Password update failed.",
      );
    }
  }

  async function handleNotificationPreferencesSubmit() {
    if (!notificationDraft) {
      return;
    }

    setNotificationNotice(null);
    setNotificationError(null);

    try {
      await updateNotificationPreferencesMutation.mutateAsync(
        notificationDraft,
      );
      setNotificationNotice("Notification preferences saved.");
    } catch (error) {
      setNotificationError(
        error instanceof Error
          ? error.message
          : "Notification preference update failed.",
      );
    }
  }

  async function handleAgeProfileSubmit() {
    setAgeNotice(null);
    setAgeError(null);

    try {
      await updateCustomerAgeProfileMutation.mutateAsync({
        dateOfBirth: ageDateOfBirthDraft.trim() || null,
      });
      setAgeNotice(
        ageDateOfBirthDraft.trim()
          ? "Date of birth saved as a self-attested age record."
          : "Age record cleared.",
      );
    } catch (error) {
      setAgeError(
        error instanceof Error ? error.message : "Age profile update failed.",
      );
    }
  }

  async function handleTrustedContactSubmit() {
    setTrustedContactNotice(null);
    setTrustedContactError(null);

    try {
      if (editingTrustedContactId) {
        await updateTrustedContactMutation.mutateAsync({
          contactId: editingTrustedContactId,
          ...trustedContactDraft,
        });
        setTrustedContactNotice("Trusted contact updated.");
      } else {
        await createTrustedContactMutation.mutateAsync(trustedContactDraft);
        setTrustedContactNotice("Trusted contact added.");
      }

      setTrustedContactDraft(emptyTrustedContactDraft);
      setEditingTrustedContactId(null);
    } catch (error) {
      setTrustedContactError(
        error instanceof Error
          ? error.message
          : "Trusted contact update failed.",
      );
    }
  }

  function handleTrustedContactEdit(contact: CustomerTrustedContactProjection) {
    setTrustedContactNotice(null);
    setTrustedContactError(null);
    setEditingTrustedContactId(contact.id);
    setTrustedContactDraft(toTrustedContactDraft(contact));
  }

  async function handleTrustedContactRemove(contactId: string) {
    setTrustedContactNotice(null);
    setTrustedContactError(null);

    try {
      await removeTrustedContactMutation.mutateAsync(contactId);
      if (editingTrustedContactId === contactId) {
        setEditingTrustedContactId(null);
        setTrustedContactDraft(emptyTrustedContactDraft);
      }
      setTrustedContactNotice("Trusted contact removed.");
    } catch (error) {
      setTrustedContactError(
        error instanceof Error
          ? error.message
          : "Trusted contact removal failed.",
      );
    }
  }

  async function handleRevokeAllSessions() {
    setSessionNotice(null);
    setSessionError(null);

    try {
      await revokeAllSessionsMutation.mutateAsync();
      setSessionNotice("All other active customer sessions were signed out.");
    } catch (error) {
      setSessionError(
        error instanceof Error ? error.message : "Session revocation failed.",
      );
    }
  }

  async function handleRevokeSession(sessionId: string) {
    setSessionNotice(null);
    setSessionError(null);

    try {
      await revokeCustomerSessionMutation.mutateAsync(sessionId);
      setSessionNotice("Selected customer session was signed out.");
    } catch (error) {
      setSessionError(
        error instanceof Error ? error.message : "Session revocation failed.",
      );
    }
  }

  async function handleStartSessionTrustChallenge() {
    setSessionNotice(null);
    setSessionError(null);

    try {
      const result = await startSessionTrustChallengeMutation.mutateAsync();
      setSessionTrustPreviewCode(result.previewCode);
      setSessionTrustCode("");
      setSessionNotice("Session verification code sent.");
    } catch (error) {
      setSessionError(
        error instanceof Error
          ? error.message
          : "Failed to send session verification code.",
      );
    }
  }

  async function handleVerifySessionTrust() {
    setSessionNotice(null);
    setSessionError(null);

    try {
      await verifyCurrentSessionTrustMutation.mutateAsync(sessionTrustCode);
      setSessionTrustCode("");
      setSessionTrustPreviewCode(null);
      setSessionNotice("Current session verified successfully.");
    } catch (error) {
      setSessionError(
        error instanceof Error
          ? error.message
          : "Failed to verify current session.",
      );
    }
  }

  async function handleStartTotp() {
    try {
      const result = await startTotpEnrollment.mutateAsync();
      setTotpSecret(result.secret);
      setTotpOtpAuthUri(result.otpAuthUri);
      setTotpCode("");
    } catch (error) {
      setPasswordError(
        error instanceof Error
          ? error.message
          : "Failed to start authenticator setup.",
      );
    }
  }

  async function handleVerifyTotp() {
    try {
      await verifyTotpEnrollment.mutateAsync({ code: totpCode });
      setTotpSecret(null);
      setTotpOtpAuthUri(null);
      setTotpCode("");
    } catch (error) {
      setPasswordError(
        error instanceof Error
          ? error.message
          : "Failed to verify authenticator setup.",
      );
    }
  }

  async function handleStartEmail() {
    try {
      const result = await startEmailEnrollment.mutateAsync();
      setEmailChallengeId(result.challengeId);
      setEmailPreviewCode(result.previewCode);
      setEmailCode("");
    } catch (error) {
      setPasswordError(
        error instanceof Error
          ? error.message
          : "Failed to start email MFA setup.",
      );
    }
  }

  async function handleVerifyEmail() {
    if (!emailChallengeId) {
      return;
    }

    try {
      await verifyEmailEnrollment.mutateAsync({
        challengeId: emailChallengeId,
        code: emailCode,
      });
      setEmailChallengeId(null);
      setEmailCode("");
      setEmailPreviewCode(null);
    } catch (error) {
      setPasswordError(
        error instanceof Error
          ? error.message
          : "Failed to verify email MFA setup.",
      );
    }
  }

  async function handleStartEmailRecovery() {
    try {
      const result = await startEmailRecovery.mutateAsync();
      setRecoveryChallengeId(result.challengeId);
      setRecoveryPreviewCode(result.previewCode);
      setRecoveryCode("");
    } catch (error) {
      setPasswordError(
        error instanceof Error
          ? error.message
          : "Failed to start MFA recovery.",
      );
    }
  }

  async function handleVerifyEmailRecovery() {
    if (!recoveryChallengeId) {
      return;
    }

    try {
      await verifyEmailRecovery.mutateAsync({
        challengeId: recoveryChallengeId,
        code: recoveryCode,
      });
      setRecoveryChallengeId(null);
      setRecoveryPreviewCode(null);
      setRecoveryCode("");
      setPasswordNotice(
        "Authenticator MFA was reset. Enroll a new authenticator now.",
      );
    } catch (error) {
      setPasswordError(
        error instanceof Error
          ? error.message
          : "Failed to verify MFA recovery.",
      );
    }
  }

  async function handleStartPasswordStepUp(method: "totp" | "email_otp") {
    try {
      const result = await startMfaChallenge.mutateAsync({
        method,
        purpose: "password_step_up",
      });
      setPasswordChallengeMethod(method);
      setPasswordChallengeId(result.challengeId);
      setPasswordPreviewCode(result.previewCode);
      setPasswordChallengeCode("");
    } catch (error) {
      setPasswordError(
        error instanceof Error
          ? error.message
          : "Failed to start MFA challenge.",
      );
    }
  }

  async function handleVerifyPasswordStepUp() {
    if (!passwordChallengeId) {
      return;
    }

    try {
      await verifyMfaChallenge.mutateAsync({
        challengeId: passwordChallengeId,
        method: passwordChallengeMethod,
        purpose: "password_step_up",
        code: passwordChallengeCode,
      });
      setPasswordChallengeId(null);
      setPasswordChallengeCode("");
      setPasswordPreviewCode(null);
    } catch (error) {
      setPasswordError(
        error instanceof Error
          ? error.message
          : "Failed to verify MFA challenge.",
      );
    }
  }

  return (
    <Layout>
      <div className="stb-page-stack space-y-8">
        <div className="stb-section-frame flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-6">
            <Avatar className="h-20 w-20 border border-border/70 bg-white/80">
              <AvatarImage src={undefined} />
              <AvatarFallback className="bg-mint-100 text-mint-800">
                {fullName
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="stb-page-title text-3xl font-semibold text-foreground">
                  Customer Profile
                </h1>
                <Badge
                  variant="outline"
                  className={
                    profile
                      ? getAccountStatusBadgeTone(profile.accountStatus)
                      : undefined
                  }
                >
                  {formatAccountStatusLabel(profile?.accountStatus, locale)}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{fullName}</p>
              <p className="text-sm text-muted-foreground">
                {profile?.email ??
                  userFromStore?.email ??
                  t("profile.notLoadedEmail")}
              </p>
            </div>
          </div>
          <Button variant="destructive" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            {t("profile.signOut")}
          </Button>
        </div>

        {profileQuery.isError || !profile ? (
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>{t("profile.loadErrorTitle")}</AlertTitle>
            <AlertDescription>
              {profileQuery.error instanceof Error
                ? profileQuery.error.message
                : t("profile.loadErrorDescription")}
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <Alert variant="muted">
              <Shield className="h-4 w-4" />
              <AlertTitle>Truthful managed-account security surface</AlertTitle>
              <AlertDescription>
                This page now shows real account identity, lifecycle status,
                wallet linkage, password rotation, and customer email
                preferences where the managed customer projection supports them.
                Legacy-only records remain visible but read-only.
              </AlertDescription>
            </Alert>

            <div className="grid gap-6 xl:grid-cols-2">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserRound className="h-5 w-5 text-mint-600" />
                    Account Identity
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div
                    className="stb-trust-note text-sm text-muted-foreground"
                    data-tone="neutral"
                  >
                    <p className="text-sm text-muted-foreground">
                      {getAccountStatusSummary(profile.accountStatus, locale)}
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="stb-section-frame p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Customer ID
                      </p>
                      <p className="mt-2 font-medium text-foreground">
                        {profile.customerId ?? t("profile.notProvisioned")}
                      </p>
                    </div>
                    <div className="stb-section-frame p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Supabase User ID
                      </p>
                      <p className="mt-2 font-medium text-foreground break-all">
                        {profile.supabaseUserId}
                      </p>
                    </div>
                    <div className="stb-section-frame p-4 sm:col-span-2">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Email
                      </p>
                      <div className="mt-2 flex items-center gap-2 text-foreground">
                        <Mail className="h-4 w-4 text-mint-700" />
                        <span>{profile.email}</span>
                      </div>
                    </div>
                  </div>
                  {lifecycleEntries.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {lifecycleEntries.map((entry) => (
                        <div
                          key={entry.label}
                          className="stb-section-frame p-4"
                        >
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            {entry.label}
                          </p>
                          <p className="mt-2 font-medium text-foreground">
                            {entry.value
                              ? formatDateLabel(entry.value, locale)
                              : t("profile.notRecorded")}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-mint-600" />
                    Managed Wallet
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="stb-section-frame p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Product-chain address
                    </p>
                    <p className="mt-2 font-mono text-sm text-foreground break-all">
                      {profile.ethereumAddress ||
                        "No managed wallet assigned yet."}
                    </p>
                  </div>
                  <div className="grid gap-4">
                    <div className="stb-section-frame p-4">
                      <p className="text-sm font-medium text-foreground">
                        Platform-managed custody
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Customer wallet access is managed by the product
                        platform. Browser wallet linking is intentionally not
                        exposed here.
                      </p>
                    </div>
                    <div className="stb-section-frame p-4">
                      <p className="text-sm font-medium text-foreground">
                        No direct disconnect action
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        The old MetaMask connect and disconnect controls were
                        removed because this portal does not use user-signed
                        browser wallet custody.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-mint-600" />
                  Multi-factor Security
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <Alert
                  variant={
                    mfa?.requiresSetup || !stepUpFresh ? "muted" : "success"
                  }
                >
                  <Shield className="h-4 w-4" />
                  <AlertTitle>
                    {mfa?.requiresSetup
                      ? "Finish MFA setup"
                      : stepUpFresh
                        ? "Fresh verification active"
                        : "Fresh verification required"}
                  </AlertTitle>
                  <AlertDescription>
                    {mfa?.requiresSetup
                      ? "Complete authenticator and email backup enrollment now. Browsing remains available, but send, withdraw, and password rotation stay blocked until setup is complete."
                      : stepUpFresh
                        ? "Money-out and password actions are currently unlocked for this session."
                        : "Before money-out or password changes, complete a fresh MFA verification."}
                  </AlertDescription>
                </Alert>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="stb-section-frame p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Authenticator app
                    </p>
                    <p className="mt-2 font-medium text-foreground">
                      {mfa?.totpEnrolled ? "Enabled" : "Not enrolled"}
                    </p>
                    {!mfa?.totpEnrolled ? (
                      <p className="mt-3 text-sm text-muted-foreground">
                        Recommended apps: {recommendedAuthenticatorApps[0]} or{" "}
                        {recommendedAuthenticatorApps[1]}.
                      </p>
                    ) : null}
                  </div>
                  <div className="stb-section-frame p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Email backup factor
                    </p>
                    <p className="mt-2 font-medium text-foreground">
                      {mfa?.emailOtpEnrolled ? "Enabled" : "Not enrolled"}
                    </p>
                  </div>
                </div>

                {!mfa?.totpEnrolled ? (
                  <div className="space-y-3 rounded-[1.5rem] border border-border bg-white/80 p-5">
                    <p className="text-sm font-medium text-foreground">
                      Start authenticator setup
                    </p>
                    <Button
                      onClick={handleStartTotp}
                      disabled={startTotpEnrollment.isPending}
                    >
                      {startTotpEnrollment.isPending
                        ? "Preparing authenticator..."
                        : "Start authenticator enrollment"}
                    </Button>
                    {totpSecret ? (
                      <>
                        <div className="stb-section-frame p-4">
                          <p className="text-sm text-muted-foreground">
                            Scan this QR code in Google Authenticator or
                            Microsoft Authenticator. Any compatible TOTP app
                            also works.
                          </p>
                          {totpOtpAuthUri ? (
                            <div className="mt-4 flex justify-center">
                              <QRCodeSVG
                                data-testid="totp-qr-code"
                                size={168}
                                value={totpOtpAuthUri}
                              />
                            </div>
                          ) : null}
                        </div>
                        <div className="stb-section-frame p-4">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Manual secret
                          </p>
                          <p className="mt-2 break-all font-mono text-sm text-foreground">
                            {totpSecret}
                          </p>
                          <p className="mt-3 text-sm text-muted-foreground">
                            Use the manual secret only if QR scanning is not
                            available.
                          </p>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-foreground">
                            6-digit code
                          </label>
                          <Input
                            value={totpCode}
                            onChange={(event) =>
                              setTotpCode(event.target.value)
                            }
                            placeholder="123456"
                          />
                        </div>
                        <Button
                          onClick={handleVerifyTotp}
                          disabled={verifyTotpEnrollment.isPending}
                        >
                          {verifyTotpEnrollment.isPending
                            ? "Verifying..."
                            : "Verify authenticator"}
                        </Button>
                      </>
                    ) : null}
                  </div>
                ) : null}

                {mfa?.totpEnrolled && !mfa?.emailOtpEnrolled ? (
                  <div className="space-y-3 rounded-[1.5rem] border border-border bg-white/80 p-5">
                    <p className="text-sm font-medium text-foreground">
                      Add email backup factor
                    </p>
                    <Button
                      onClick={handleStartEmail}
                      disabled={startEmailEnrollment.isPending}
                    >
                      {startEmailEnrollment.isPending
                        ? "Sending code..."
                        : "Send email verification code"}
                    </Button>
                    {emailChallengeId ? (
                      <>
                        {emailPreviewCode ? (
                          <div className="stb-section-frame p-4 text-sm text-muted-foreground">
                            Preview code:{" "}
                            <span className="font-semibold text-foreground">
                              {emailPreviewCode}
                            </span>
                          </div>
                        ) : null}
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-foreground">
                            6-digit code
                          </label>
                          <Input
                            value={emailCode}
                            onChange={(event) =>
                              setEmailCode(event.target.value)
                            }
                            placeholder="123456"
                          />
                        </div>
                        <Button
                          onClick={handleVerifyEmail}
                          disabled={verifyEmailEnrollment.isPending}
                        >
                          {verifyEmailEnrollment.isPending
                            ? "Verifying..."
                            : "Verify email backup"}
                        </Button>
                      </>
                    ) : null}
                  </div>
                ) : null}

                {mfa?.totpEnrolled && mfa?.emailOtpEnrolled ? (
                  <div className="space-y-3 rounded-[1.5rem] border border-border bg-white/80 p-5">
                    <p className="text-sm font-medium text-foreground">
                      Lost the authenticator device?
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Reset only the authenticator by proving control of the
                      backup email factor, then enroll a new authenticator
                      immediately after recovery.
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => {
                        void handleStartEmailRecovery();
                      }}
                    >
                      Send recovery email code
                    </Button>
                    {recoveryChallengeId ? (
                      <>
                        {recoveryPreviewCode ? (
                          <div className="stb-section-frame p-4 text-sm text-muted-foreground">
                            Preview code:{" "}
                            <span className="font-semibold text-foreground">
                              {recoveryPreviewCode}
                            </span>
                          </div>
                        ) : null}
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-foreground">
                            6-digit code
                          </label>
                          <Input
                            value={recoveryCode}
                            onChange={(event) =>
                              setRecoveryCode(event.target.value)
                            }
                            placeholder="123456"
                          />
                        </div>
                        <Button
                          onClick={handleVerifyEmailRecovery}
                          disabled={verifyEmailRecovery.isPending}
                        >
                          {verifyEmailRecovery.isPending
                            ? "Verifying..."
                            : "Verify recovery code"}
                        </Button>
                      </>
                    ) : null}
                  </div>
                ) : null}

                {!mfa?.requiresSetup && !stepUpFresh ? (
                  <div className="space-y-3 rounded-[1.5rem] border border-border bg-white/80 p-5">
                    <p className="text-sm font-medium text-foreground">
                      Refresh verification for password changes
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <Button
                        variant="outline"
                        onClick={() => {
                          void handleStartPasswordStepUp("totp");
                        }}
                      >
                        Use authenticator
                      </Button>
                      {mfa?.emailOtpEnrolled ? (
                        <Button
                          variant="outline"
                          onClick={() => {
                            void handleStartPasswordStepUp("email_otp");
                          }}
                        >
                          Use email backup
                        </Button>
                      ) : null}
                    </div>
                    {passwordChallengeId ? (
                      <>
                        {passwordPreviewCode ? (
                          <div className="stb-section-frame p-4 text-sm text-muted-foreground">
                            Preview code:{" "}
                            <span className="font-semibold text-foreground">
                              {passwordPreviewCode}
                            </span>
                          </div>
                        ) : null}
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-foreground">
                            6-digit code
                          </label>
                          <Input
                            value={passwordChallengeCode}
                            onChange={(event) =>
                              setPasswordChallengeCode(event.target.value)
                            }
                            placeholder="123456"
                          />
                        </div>
                        <Button
                          onClick={handleVerifyPasswordStepUp}
                          disabled={verifyMfaChallenge.isPending}
                        >
                          {verifyMfaChallenge.isPending
                            ? "Verifying..."
                            : "Verify MFA challenge"}
                        </Button>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-mint-600" />
                  Security Controls
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <div className="stb-section-frame p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <CheckCircle2 className="h-4 w-4 text-mint-700" />
                    Identity State
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Access is governed by the backend account lifecycle state,
                    currently marked as{" "}
                    {formatAccountStatusLabel(profile.accountStatus, locale)}.
                  </p>
                </div>
                <div className="stb-section-frame p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <CheckCircle2 className="h-4 w-4 text-mint-700" />
                    Password Management
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {passwordRotationAvailable
                      ? "Self-service password rotation is available for this managed customer account."
                      : "This profile does not currently expose self-service password rotation, so the section below remains read-only."}
                  </p>
                </div>
                <div className="stb-section-frame p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <CheckCircle2 className="h-4 w-4 text-mint-700" />
                    Notifications
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {notificationPreferencesAvailable
                      ? "Customer notification delivery is now managed as a category-by-channel matrix across in-app and email delivery."
                      : "This profile does not yet expose customer-editable notification preferences, so the section below remains read-only."}
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 xl:grid-cols-2">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Password Management</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div
                    className="stb-trust-note text-sm text-muted-foreground"
                    data-tone="neutral"
                  >
                    <p className="text-sm text-muted-foreground">
                      Security and account-risk notifications remain mandatory.
                      Updating the password changes only your authentication
                      credential and does not alter managed wallet custody.
                    </p>
                  </div>

                  {passwordNotice ? (
                    <Alert variant="success">
                      <CheckCircle2 className="h-4 w-4" />
                      <AlertTitle>Password updated</AlertTitle>
                      <AlertDescription>{passwordNotice}</AlertDescription>
                    </Alert>
                  ) : null}

                  {passwordError ? (
                    <Alert variant="destructive">
                      <ShieldAlert className="h-4 w-4" />
                      <AlertTitle>Password update failed</AlertTitle>
                      <AlertDescription>{passwordError}</AlertDescription>
                    </Alert>
                  ) : null}

                  {passwordRotationAvailable ? (
                    <>
                      {!stepUpFresh ? (
                        <Alert variant="muted">
                          <ShieldAlert className="h-4 w-4" />
                          <AlertTitle>Fresh MFA required</AlertTitle>
                          <AlertDescription>
                            Verify MFA in the security section above before
                            changing the password.
                          </AlertDescription>
                        </Alert>
                      ) : null}
                      <div className="space-y-2">
                        <label
                          htmlFor="current-password"
                          className="text-sm font-medium text-foreground"
                        >
                          Current password
                        </label>
                        <Input
                          id="current-password"
                          type="password"
                          value={passwordForm.currentPassword}
                          onChange={(event) =>
                            setPasswordForm((current) => ({
                              ...current,
                              currentPassword: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <label
                          htmlFor="new-password"
                          className="text-sm font-medium text-foreground"
                        >
                          New password
                        </label>
                        <Input
                          id="new-password"
                          type="password"
                          value={passwordForm.newPassword}
                          onChange={(event) =>
                            setPasswordForm((current) => ({
                              ...current,
                              newPassword: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <label
                          htmlFor="confirm-password"
                          className="text-sm font-medium text-foreground"
                        >
                          Confirm new password
                        </label>
                        <Input
                          id="confirm-password"
                          type="password"
                          value={passwordForm.confirmPassword}
                          onChange={(event) =>
                            setPasswordForm((current) => ({
                              ...current,
                              confirmPassword: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <Button
                        onClick={handlePasswordSubmit}
                        disabled={
                          rotatePasswordMutation.isPending || !stepUpFresh
                        }
                      >
                        {rotatePasswordMutation.isPending
                          ? "Updating password..."
                          : "Update password"}
                      </Button>
                    </>
                  ) : (
                    <div className="stb-section-frame p-4">
                      <p className="text-sm font-medium text-foreground">
                        Password rotation unavailable
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        This profile is still backed by a legacy or incomplete
                        customer projection, so password changes cannot be
                        performed from the customer portal yet.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Session Security</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div
                    className="stb-trust-note text-sm text-muted-foreground"
                    data-tone="warning"
                  >
                    <p className="text-sm text-muted-foreground">
                      Revoke every other active customer session and immediately
                      replace this browser token with a fresh one.
                    </p>
                  </div>

                  {sessionNotice ? (
                    <Alert variant="success">
                      <CheckCircle2 className="h-4 w-4" />
                      <AlertTitle>Sessions revoked</AlertTitle>
                      <AlertDescription>{sessionNotice}</AlertDescription>
                    </Alert>
                  ) : null}

                  {sessionError ? (
                    <Alert variant="destructive">
                      <ShieldAlert className="h-4 w-4" />
                      <AlertTitle>Session revocation failed</AlertTitle>
                      <AlertDescription>{sessionError}</AlertDescription>
                    </Alert>
                  ) : null}

                  {sessionSecurity?.currentSessionRequiresVerification ? (
                    <Alert variant="destructive">
                      <ShieldAlert className="h-4 w-4" />
                      <AlertTitle>Verify this session</AlertTitle>
                      <AlertDescription>
                        This sign-in is not yet trusted. Withdrawals and
                        password changes stay blocked until you verify this
                        browser from your security email code.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Alert variant="success">
                      <Shield className="h-4 w-4" />
                      <AlertTitle>Current session trusted</AlertTitle>
                      <AlertDescription>
                        This session is verified for sensitive customer actions.
                      </AlertDescription>
                    </Alert>
                  )}

                  {sessionSecurity?.currentSessionRequiresVerification ? (
                    <div className="stb-section-frame space-y-3 p-4">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">
                          Verify current session
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Send a code to the customer email on file, then enter
                          it here to trust this session.
                        </p>
                      </div>
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <Button
                          variant="outline"
                          onClick={handleStartSessionTrustChallenge}
                          disabled={
                            startSessionTrustChallengeMutation.isPending
                          }
                        >
                          {startSessionTrustChallengeMutation.isPending
                            ? "Sending code..."
                            : "Send verification code"}
                        </Button>
                        <Input
                          value={sessionTrustCode}
                          onChange={(event) =>
                            setSessionTrustCode(event.target.value)
                          }
                          placeholder="6-digit code"
                          inputMode="numeric"
                          maxLength={6}
                        />
                        <Button
                          onClick={handleVerifySessionTrust}
                          disabled={
                            verifyCurrentSessionTrustMutation.isPending ||
                            sessionTrustCode.trim().length !== 6
                          }
                        >
                          {verifyCurrentSessionTrustMutation.isPending
                            ? "Verifying..."
                            : "Verify session"}
                        </Button>
                      </div>
                      {sessionTrustPreviewCode ? (
                        <p className="text-xs text-muted-foreground">
                          Dev preview code: {sessionTrustPreviewCode}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <Button
                    variant="outline"
                    onClick={handleRevokeAllSessions}
                    disabled={revokeAllSessionsMutation.isPending}
                  >
                    {revokeAllSessionsMutation.isPending
                      ? "Revoking sessions..."
                      : "Revoke all other sessions"}
                  </Button>

                  <div className="space-y-3">
                    <div className="stb-trust-note text-sm text-muted-foreground">
                      <p className="text-sm font-medium text-foreground">
                        Active sessions
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Review every active device or browser token and revoke
                        anything you do not recognize.
                      </p>
                    </div>

                    {customerSessionsQuery.isLoading ? (
                      <div className="stb-section-frame p-4 text-sm text-muted-foreground">
                        Loading active sessions...
                      </div>
                    ) : customerSessionsQuery.isError ? (
                      <Alert variant="destructive">
                        <ShieldAlert className="h-4 w-4" />
                        <AlertTitle>Session inventory unavailable</AlertTitle>
                        <AlertDescription>
                          {customerSessionsQuery.error instanceof Error
                            ? customerSessionsQuery.error.message
                            : "Failed to load customer sessions."}
                        </AlertDescription>
                      </Alert>
                    ) : customerSessions.length > 0 ? (
                      <div className="space-y-3">
                        {customerSessions.map((session) => (
                          <div
                            key={session.id}
                            className="stb-section-frame flex flex-col gap-3 p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <MonitorSmartphone className="h-4 w-4 text-muted-foreground" />
                                  <p className="text-sm font-medium text-foreground">
                                    {formatSessionLabel(session)}
                                  </p>
                                  {session.current ? (
                                    <Badge variant="secondary">Current</Badge>
                                  ) : null}
                                  <Badge
                                    variant={
                                      session.trusted
                                        ? "secondary"
                                        : "destructive"
                                    }
                                  >
                                    {session.trusted ? "Trusted" : "Verify"}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Last seen{" "}
                                  {formatDateLabel(session.lastSeenAt, locale)}
                                </p>
                                {session.ipAddress ? (
                                  <p className="text-xs text-muted-foreground">
                                    IP {session.ipAddress}
                                  </p>
                                ) : null}
                                {session.userAgent ? (
                                  <p className="text-xs text-muted-foreground">
                                    {session.userAgent}
                                  </p>
                                ) : null}
                              </div>

                              {!session.current ? (
                                <Button
                                  variant="outline"
                                  onClick={() =>
                                    void handleRevokeSession(session.id)
                                  }
                                  disabled={
                                    revokeCustomerSessionMutation.isPending
                                  }
                                >
                                  {revokeCustomerSessionMutation.isPending
                                    ? "Revoking..."
                                    : "Revoke session"}
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="stb-section-frame p-4 text-sm text-muted-foreground">
                        No active customer sessions were recorded yet.
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="stb-trust-note text-sm text-muted-foreground">
                      <p className="text-sm font-medium text-foreground">
                        Recent security activity
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Review recent sign-ins, MFA changes, and session
                        actions.
                      </p>
                    </div>

                    {securityActivityQuery.isLoading ? (
                      <div className="stb-section-frame p-4 text-sm text-muted-foreground">
                        Loading security activity...
                      </div>
                    ) : securityActivityQuery.isError ? (
                      <Alert variant="destructive">
                        <ShieldAlert className="h-4 w-4" />
                        <AlertTitle>Security activity unavailable</AlertTitle>
                        <AlertDescription>
                          {securityActivityQuery.error instanceof Error
                            ? securityActivityQuery.error.message
                            : "Failed to load security activity."}
                        </AlertDescription>
                      </Alert>
                    ) : securityActivity.length > 0 ? (
                      <div className="space-y-3">
                        {securityActivity.map((event) => (
                          <div
                            key={event.id}
                            className="stb-section-frame flex flex-col gap-2 p-4"
                          >
                            <p className="text-sm font-medium text-foreground">
                              {formatSecurityActivityTitle(event)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDateLabel(event.createdAt, locale)}
                            </p>
                            {formatSecurityActivityDetail(event) ? (
                              <p className="text-sm text-muted-foreground">
                                {formatSecurityActivityDetail(event)}
                              </p>
                            ) : null}
                            {event.ipAddress ? (
                              <p className="text-xs text-muted-foreground">
                                IP {event.ipAddress}
                              </p>
                            ) : null}
                            {event.userAgent ? (
                              <p className="text-xs text-muted-foreground">
                                {event.userAgent}
                              </p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="stb-section-frame p-4 text-sm text-muted-foreground">
                        No recent security activity was recorded yet.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Notification Preferences</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div
                    className="stb-trust-note text-sm text-muted-foreground"
                    data-tone="neutral"
                  >
                    <p className="text-sm font-medium text-foreground">
                      Matrix-based delivery
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Security notices remain mandatory. This matrix controls
                      supported delivery channels for the rest of the customer
                      notification system.
                    </p>
                  </div>

                  {notificationNotice ? (
                    <Alert variant="success">
                      <CheckCircle2 className="h-4 w-4" />
                      <AlertTitle>Preferences saved</AlertTitle>
                      <AlertDescription>{notificationNotice}</AlertDescription>
                    </Alert>
                  ) : null}

                  {notificationError ? (
                    <Alert variant="destructive">
                      <ShieldAlert className="h-4 w-4" />
                      <AlertTitle>Preference update failed</AlertTitle>
                      <AlertDescription>{notificationError}</AlertDescription>
                    </Alert>
                  ) : null}

                  {notificationDraft ? (
                    <>
                      {notificationDraft.entries.map((entry) => (
                        <div
                          key={entry.category}
                          className="stb-section-frame flex items-start justify-between gap-4 p-4"
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="text-sm font-medium text-foreground">
                              {notificationCategoryLabels[entry.category]}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Choose how this category reaches you across the
                              supported notification channels.
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center justify-end gap-3">
                            {entry.channels
                              .filter((channel) =>
                                notificationDraft.supportedChannels.includes(
                                  channel.channel,
                                ),
                              )
                              .map((channel) => (
                                <div
                                  key={`${entry.category}-${channel.channel}`}
                                  className="flex items-center gap-2"
                                >
                                  <span className="text-xs text-muted-foreground">
                                    {notificationChannelLabels[channel.channel]}
                                  </span>
                                  <Switch
                                    aria-label={`${notificationCategoryLabels[entry.category]} ${notificationChannelLabels[channel.channel]}`}
                                    checked={channel.enabled}
                                    disabled={channel.mandatory}
                                    onCheckedChange={(checked) =>
                                      setNotificationDraft((current) =>
                                        current
                                          ? {
                                              ...current,
                                              entries: current.entries.map(
                                                (candidate) =>
                                                  candidate.category !==
                                                  entry.category
                                                    ? candidate
                                                    : {
                                                        ...candidate,
                                                        channels:
                                                          candidate.channels.map(
                                                            (
                                                              candidateChannel,
                                                            ) =>
                                                              candidateChannel.channel !==
                                                              channel.channel
                                                                ? candidateChannel
                                                                : {
                                                                    ...candidateChannel,
                                                                    enabled:
                                                                      checked,
                                                                  },
                                                          ),
                                                      },
                                              ),
                                            }
                                          : current,
                                      )
                                    }
                                  />
                                </div>
                              ))}
                          </div>
                        </div>
                      ))}
                      <Button
                        onClick={handleNotificationPreferencesSubmit}
                        disabled={
                          updateNotificationPreferencesMutation.isPending ||
                          !notificationPreferencesChanged
                        }
                      >
                        {updateNotificationPreferencesMutation.isPending
                          ? "Saving preferences..."
                          : "Save preferences"}
                      </Button>
                    </>
                  ) : (
                    <div className="stb-section-frame p-4">
                      <p className="text-sm font-medium text-foreground">
                        Notification preferences unavailable
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        This profile is currently read-only, so
                        customer-editable notification preferences are not
                        available from this portal yet.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Age And Identity Foundation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div
                    className="stb-trust-note text-sm text-muted-foreground"
                    data-tone="neutral"
                  >
                    <p className="text-sm font-medium text-foreground">
                      Date of birth is foundational vault data
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      This profile record prepares age-based vault rules and
                      operator verification. Customer edits are treated as
                      self-attested until reviewed.
                    </p>
                  </div>

                  {ageNotice ? (
                    <Alert variant="success">
                      <CheckCircle2 className="h-4 w-4" />
                      <AlertTitle>Age profile saved</AlertTitle>
                      <AlertDescription>{ageNotice}</AlertDescription>
                    </Alert>
                  ) : null}

                  {ageError ? (
                    <Alert variant="destructive">
                      <ShieldAlert className="h-4 w-4" />
                      <AlertTitle>Age profile update failed</AlertTitle>
                      <AlertDescription>{ageError}</AlertDescription>
                    </Alert>
                  ) : null}

                  {profile.customerId ? (
                    <>
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="stb-section-frame p-4">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Verification status
                          </p>
                          <p className="mt-2 font-medium text-foreground">
                            {formatAgeVerificationStatusLabel(
                              ageProfile?.verificationStatus ?? "unverified",
                            )}
                          </p>
                        </div>
                        <div className="stb-section-frame p-4">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Derived age
                          </p>
                          <p className="mt-2 font-medium text-foreground">
                            {ageProfile?.ageYears ?? "Not recorded"}
                          </p>
                        </div>
                        <div className="stb-section-frame p-4">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Adult threshold
                          </p>
                          <p className="mt-2 font-medium text-foreground">
                            {ageProfile?.legalAdult === null
                              ? "Not yet determined"
                              : ageProfile.legalAdult
                                ? "18+ confirmed by DOB"
                                : "Under 18 by DOB"}
                          </p>
                        </div>
                      </div>

                      {ageProfile?.verificationNote ? (
                        <div className="stb-section-frame p-4">
                          <p className="text-sm font-medium text-foreground">
                            Verification note
                          </p>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {ageProfile.verificationNote}
                          </p>
                        </div>
                      ) : null}

                      <div className="space-y-2">
                        <label
                          htmlFor="date-of-birth"
                          className="text-sm font-medium text-foreground"
                        >
                          Date of birth
                        </label>
                        <Input
                          id="date-of-birth"
                          type="date"
                          value={ageDateOfBirthDraft}
                          onChange={(event) =>
                            setAgeDateOfBirthDraft(event.target.value)
                          }
                        />
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <Button
                          onClick={handleAgeProfileSubmit}
                          disabled={
                            updateCustomerAgeProfileMutation.isPending ||
                            !ageProfileChanged
                          }
                        >
                          {updateCustomerAgeProfileMutation.isPending
                            ? "Saving age profile..."
                            : "Save date of birth"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setAgeDateOfBirthDraft("");
                          }}
                          disabled={
                            updateCustomerAgeProfileMutation.isPending ||
                            !ageDateOfBirthDraft
                          }
                        >
                          Clear draft
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="stb-section-frame p-4">
                      <p className="text-sm font-medium text-foreground">
                        Age profile unavailable
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Legacy-only records do not yet expose managed customer
                        age data from this portal.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Trusted Contacts And Beneficiaries</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div
                    className="stb-trust-note text-sm text-muted-foreground"
                    data-tone="neutral"
                  >
                    <p className="text-sm font-medium text-foreground">
                      Release governance foundation
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      These records prepare future dual-approval and
                      beneficiary-aware vault workflows. They do not yet create
                      release rights by themselves.
                    </p>
                  </div>

                  {trustedContactNotice ? (
                    <Alert variant="success">
                      <CheckCircle2 className="h-4 w-4" />
                      <AlertTitle>Trusted contact saved</AlertTitle>
                      <AlertDescription>
                        {trustedContactNotice}
                      </AlertDescription>
                    </Alert>
                  ) : null}

                  {trustedContactError ? (
                    <Alert variant="destructive">
                      <ShieldAlert className="h-4 w-4" />
                      <AlertTitle>Trusted contact update failed</AlertTitle>
                      <AlertDescription>{trustedContactError}</AlertDescription>
                    </Alert>
                  ) : null}

                  {profile.customerId ? (
                    <>
                      {trustedContacts.length > 0 ? (
                        <div className="space-y-3">
                          {trustedContacts.map((contact) => (
                            <div
                              key={contact.id}
                              className="stb-section-frame flex flex-col gap-3 p-4"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-medium text-foreground">
                                      {contact.firstName} {contact.lastName}
                                    </p>
                                    <Badge variant="secondary">
                                      {formatTrustedContactKindLabel(
                                        contact.kind,
                                      )}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    {contact.relationshipLabel}
                                  </p>
                                  {contact.email ? (
                                    <p className="text-xs text-muted-foreground">
                                      {contact.email}
                                    </p>
                                  ) : null}
                                  {contact.phoneNumber ? (
                                    <p className="text-xs text-muted-foreground">
                                      {contact.phoneNumber}
                                    </p>
                                  ) : null}
                                  {contact.note ? (
                                    <p className="text-xs text-muted-foreground">
                                      {contact.note}
                                    </p>
                                  ) : null}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    variant="outline"
                                    onClick={() =>
                                      handleTrustedContactEdit(contact)
                                    }
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    variant="outline"
                                    onClick={() =>
                                      void handleTrustedContactRemove(
                                        contact.id,
                                      )
                                    }
                                    disabled={
                                      removeTrustedContactMutation.isPending
                                    }
                                  >
                                    Remove
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="stb-section-frame p-4 text-sm text-muted-foreground">
                          No trusted contacts are recorded yet.
                        </div>
                      )}

                      <div className="space-y-4 rounded-[1.5rem] border border-border bg-white/80 p-5">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-foreground">
                            {editingTrustedContactId
                              ? "Edit trusted contact"
                              : "Add trusted contact"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            At least one contact method is required.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium text-foreground">
                            Contact role
                          </label>
                          <select
                            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"
                            value={trustedContactDraft.kind}
                            onChange={(event) =>
                              setTrustedContactDraft((current) => ({
                                ...current,
                                kind: event.target.value as
                                  | "trusted_contact"
                                  | "beneficiary",
                              }))
                            }
                          >
                            <option value="trusted_contact">
                              Trusted contact
                            </option>
                            <option value="beneficiary">Beneficiary</option>
                          </select>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">
                              First name
                            </label>
                            <Input
                              value={trustedContactDraft.firstName}
                              onChange={(event) =>
                                setTrustedContactDraft((current) => ({
                                  ...current,
                                  firstName: event.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">
                              Last name
                            </label>
                            <Input
                              value={trustedContactDraft.lastName}
                              onChange={(event) =>
                                setTrustedContactDraft((current) => ({
                                  ...current,
                                  lastName: event.target.value,
                                }))
                              }
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium text-foreground">
                            Relationship
                          </label>
                          <Input
                            value={trustedContactDraft.relationshipLabel}
                            onChange={(event) =>
                              setTrustedContactDraft((current) => ({
                                ...current,
                                relationshipLabel: event.target.value,
                              }))
                            }
                            placeholder="Sister, spouse, attorney, parent"
                          />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">
                              Email
                            </label>
                            <Input
                              value={trustedContactDraft.email}
                              onChange={(event) =>
                                setTrustedContactDraft((current) => ({
                                  ...current,
                                  email: event.target.value,
                                }))
                              }
                              placeholder="name@example.com"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">
                              Phone number
                            </label>
                            <Input
                              value={trustedContactDraft.phoneNumber}
                              onChange={(event) =>
                                setTrustedContactDraft((current) => ({
                                  ...current,
                                  phoneNumber: event.target.value,
                                }))
                              }
                              placeholder="+1 555 000 1111"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium text-foreground">
                            Note
                          </label>
                          <Input
                            value={trustedContactDraft.note}
                            onChange={(event) =>
                              setTrustedContactDraft((current) => ({
                                ...current,
                                note: event.target.value,
                              }))
                            }
                            placeholder="Emergency-only contact, estate counsel, etc."
                          />
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <Button
                            onClick={handleTrustedContactSubmit}
                            disabled={
                              createTrustedContactMutation.isPending ||
                              updateTrustedContactMutation.isPending
                            }
                          >
                            {createTrustedContactMutation.isPending ||
                            updateTrustedContactMutation.isPending
                              ? "Saving trusted contact..."
                              : editingTrustedContactId
                                ? "Update trusted contact"
                                : "Add trusted contact"}
                          </Button>
                          {editingTrustedContactId ? (
                            <Button
                              variant="outline"
                              onClick={() => {
                                setEditingTrustedContactId(null);
                                setTrustedContactDraft(
                                  emptyTrustedContactDraft,
                                );
                              }}
                            >
                              Cancel editing
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="stb-section-frame p-4">
                      <p className="text-sm font-medium text-foreground">
                        Trusted contacts unavailable
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Legacy-only records do not yet expose managed customer
                        contact governance from this portal.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default Profile;
