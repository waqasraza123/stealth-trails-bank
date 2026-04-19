export type AccountLifecycleStatusValue =
  | "registered"
  | "email_verified"
  | "review_required"
  | "active"
  | "restricted"
  | "frozen"
  | "closed";

export type CustomerNotificationPreferences = {
  depositEmails: boolean;
  withdrawalEmails: boolean;
  loanEmails: boolean;
  productUpdateEmails: boolean;
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

export type CustomerSessionProjection = {
  id: string;
  current: boolean;
  clientPlatform: "web" | "mobile" | "unknown";
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
    | "mfa_step_up_verified";
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
  mfa: CustomerMfaStatus;
};
