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
};
