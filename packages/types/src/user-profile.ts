import type { NotificationPreferenceMatrix } from "./notifications";

export type AccountLifecycleStatusValue =
  | "registered"
  | "email_verified"
  | "review_required"
  | "active"
  | "restricted"
  | "frozen"
  | "closed";

export type CustomerNotificationPreferences = NotificationPreferenceMatrix;

export type CustomerAgeVerificationStatus =
  | "unverified"
  | "self_attested"
  | "verified"
  | "rejected";

export type CustomerAgeProfile = {
  dateOfBirth: string | null;
  ageYears: number | null;
  legalAdult: boolean | null;
  verificationStatus: CustomerAgeVerificationStatus;
  verifiedAt: string | null;
  verifiedByOperatorId: string | null;
  verificationNote: string | null;
};

export type CustomerTrustedContactKind = "trusted_contact" | "beneficiary";

export type CustomerTrustedContactStatus = "active" | "removed";

export type CustomerTrustedContactProjection = {
  id: string;
  kind: CustomerTrustedContactKind;
  status: CustomerTrustedContactStatus;
  firstName: string;
  lastName: string;
  relationshipLabel: string;
  email: string | null;
  phoneNumber: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  removedAt: string | null;
};

export type CustomerMfaStatus = {
  required: boolean;
  totpEnrolled: boolean;
  emailOtpEnrolled: boolean;
  requiresSetup: boolean;
  moneyMovementBlocked: boolean;
  stepUpFreshUntil: string | null;
  lockedUntil: string | null;
};

export type CustomerSessionSecurityStatus = {
  currentSessionTrusted: boolean;
  currentSessionRequiresVerification: boolean;
};

export type CustomerSessionProjection = {
  id: string;
  current: boolean;
  clientPlatform: "web" | "mobile" | "unknown";
  trusted: boolean;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastSeenAt: string;
};

export type CustomerSecurityActivityProjection = {
  id: string;
  kind:
    | "login"
    | "session_revoked"
    | "sessions_revoked"
    | "password_rotated"
    | "mfa_authenticator_enrolled"
    | "mfa_email_backup_enrolled"
    | "mfa_recovery_completed"
    | "mfa_step_up_verified"
    | "session_trust_verified";
  createdAt: string;
  clientPlatform: "web" | "mobile" | "unknown" | null;
  ipAddress: string | null;
  userAgent: string | null;
  purpose:
    | "withdrawal_step_up"
    | "password_step_up"
    | "email_enrollment"
    | "email_recovery"
    | null;
  method: "totp" | "email_otp" | null;
};

export type UserProfileProjection = {
  id: number | null;
  customerId: string | null;
  supabaseUserId: string;
  email: string;
  firstName: string;
  lastName: string;
  ethereumAddress: string;
  accountStatus: AccountLifecycleStatusValue | null;
  activatedAt: string | null;
  restrictedAt: string | null;
  frozenAt: string | null;
  closedAt: string | null;
  passwordRotationAvailable: boolean;
  notificationPreferences: CustomerNotificationPreferences | null;
  ageProfile: CustomerAgeProfile | null;
  trustedContacts: CustomerTrustedContactProjection[];
  mfa: CustomerMfaStatus;
  sessionSecurity: CustomerSessionSecurityStatus;
};
