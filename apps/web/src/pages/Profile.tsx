import { useEffect, useState } from "react";
import type { CustomerNotificationPreferences } from "@stealth-trails-bank/types";
import { Layout } from "@/components/Layout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  CheckCircle2,
  Loader2,
  LogOut,
  Mail,
  Shield,
  ShieldAlert,
  UserRound,
  Wallet
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLocale } from "@/i18n/use-locale";
import { useT } from "@/i18n/use-t";
import { useRotatePassword, useUpdateNotificationPreferences } from "@/hooks/user/useProfileSettings";
import { useGetUser } from "@/hooks/user/useGetUser";
import {
  formatAccountStatusLabel,
  getAccountLifecycleEntries,
  getAccountStatusBadgeTone,
  getAccountStatusSummary
} from "@/lib/customer-account";
import { formatDateLabel } from "@/lib/customer-finance";
import { useUserStore } from "@/stores/userStore";

const emptyPasswordForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: ""
};

function sameNotificationPreferences(
  left: CustomerNotificationPreferences | null,
  right: CustomerNotificationPreferences | null
): boolean {
  if (!left || !right) {
    return left === right;
  }

  return (
    left.depositEmails === right.depositEmails &&
    left.withdrawalEmails === right.withdrawalEmails &&
    left.loanEmails === right.loanEmails &&
    left.productUpdateEmails === right.productUpdateEmails
  );
}

const Profile = () => {
  const t = useT();
  const { locale } = useLocale();
  const navigate = useNavigate();
  const userFromStore = useUserStore((state) => state.user);
  const clearUser = useUserStore((state) => state.clearUser);
  const profileQuery = useGetUser(userFromStore?.supabaseUserId);
  const rotatePasswordMutation = useRotatePassword();
  const updateNotificationPreferencesMutation = useUpdateNotificationPreferences();
  const profile = profileQuery.data;

  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [notificationDraft, setNotificationDraft] =
    useState<CustomerNotificationPreferences | null>(null);
  const [notificationNotice, setNotificationNotice] = useState<string | null>(null);
  const [notificationError, setNotificationError] = useState<string | null>(null);

  useEffect(() => {
    setNotificationDraft(profile?.notificationPreferences ?? null);
  }, [profile?.notificationPreferences]);

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
  const notificationPreferencesAvailable =
    profile?.notificationPreferences !== null &&
    typeof profile?.notificationPreferences !== "undefined";
  const notificationPreferencesChanged = !sameNotificationPreferences(
    notificationDraft,
    profile?.notificationPreferences ?? null
  );

  async function handlePasswordSubmit() {
    setPasswordNotice(null);
    setPasswordError(null);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("Confirm password must match the new password.");
      return;
    }

    try {
      await rotatePasswordMutation.mutateAsync({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });
      setPasswordForm(emptyPasswordForm);
      setPasswordNotice("Password updated successfully.");
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "Password update failed.");
    }
  }

  async function handleNotificationPreferencesSubmit() {
    if (!notificationDraft) {
      return;
    }

    setNotificationNotice(null);
    setNotificationError(null);

    try {
      await updateNotificationPreferencesMutation.mutateAsync(notificationDraft);
      setNotificationNotice("Notification preferences saved.");
    } catch (error) {
      setNotificationError(
        error instanceof Error
          ? error.message
          : "Notification preference update failed."
      );
    }
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
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
                <h1 className="text-3xl font-semibold text-foreground">
                  Customer Profile
                </h1>
                <Badge
                  variant="outline"
                  className={profile ? getAccountStatusBadgeTone(profile.accountStatus) : undefined}
                >
                  {formatAccountStatusLabel(profile?.accountStatus, locale)}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{fullName}</p>
              <p className="text-sm text-muted-foreground">
                {profile?.email ?? userFromStore?.email ?? t("profile.notLoadedEmail")}
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
            <Alert className="border-apple-blue bg-apple-soft-blue">
              <Shield className="h-4 w-4" />
              <AlertTitle>Truthful managed-account security surface</AlertTitle>
              <AlertDescription>
                This page now shows real account identity, lifecycle status,
                wallet linkage, password rotation, and customer email
                preferences where the managed customer projection supports
                them. Legacy-only records remain visible but read-only.
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
                  <div className="rounded-xl border border-border/70 bg-white/70 p-4">
                    <p className="text-sm text-muted-foreground">
                      {getAccountStatusSummary(profile.accountStatus, locale)}
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Customer ID
                      </p>
                      <p className="mt-2 font-medium text-foreground">
                        {profile.customerId ?? t("profile.notProvisioned")}
                      </p>
                    </div>
                    <div className="rounded-xl border p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Supabase User ID
                      </p>
                      <p className="mt-2 font-medium text-foreground break-all">
                        {profile.supabaseUserId}
                      </p>
                    </div>
                    <div className="rounded-xl border p-4 sm:col-span-2">
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
                        <div key={entry.label} className="rounded-xl border p-4">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            {entry.label}
                          </p>
                          <p className="mt-2 font-medium text-foreground">
                            {entry.value ? formatDateLabel(entry.value, locale) : t("profile.notRecorded")}
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
                  <div className="rounded-xl border border-border/70 bg-white/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Product-chain address
                    </p>
                    <p className="mt-2 font-mono text-sm text-foreground break-all">
                      {profile.ethereumAddress || "No managed wallet assigned yet."}
                    </p>
                  </div>
                  <div className="grid gap-4">
                    <div className="rounded-xl border p-4">
                      <p className="text-sm font-medium text-foreground">
                        Platform-managed custody
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Customer wallet access is managed by the product platform.
                        Browser wallet linking is intentionally not exposed here.
                      </p>
                    </div>
                    <div className="rounded-xl border p-4">
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
                  Security Controls
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <CheckCircle2 className="h-4 w-4 text-mint-700" />
                    Identity State
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Access is governed by the backend account lifecycle state,
                    currently marked as {formatAccountStatusLabel(profile.accountStatus, locale)}.
                  </p>
                </div>
                <div className="rounded-xl border p-4">
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
                <div className="rounded-xl border p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <CheckCircle2 className="h-4 w-4 text-mint-700" />
                    Notifications
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {notificationPreferencesAvailable
                      ? "Customer-editable email preferences are available for transaction, lending, and product update notices."
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
                  <div className="rounded-xl border border-border/70 bg-white/70 p-4">
                    <p className="text-sm text-muted-foreground">
                      Security and account-risk notifications remain mandatory.
                      Updating the password changes only your authentication
                      credential and does not alter managed wallet custody.
                    </p>
                  </div>

                  {passwordNotice ? (
                    <Alert className="border-emerald-200 bg-emerald-50">
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
                      <div className="space-y-2">
                        <label htmlFor="current-password" className="text-sm font-medium text-foreground">
                          Current password
                        </label>
                        <Input
                          id="current-password"
                          type="password"
                          value={passwordForm.currentPassword}
                          onChange={(event) =>
                            setPasswordForm((current) => ({
                              ...current,
                              currentPassword: event.target.value
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="new-password" className="text-sm font-medium text-foreground">
                          New password
                        </label>
                        <Input
                          id="new-password"
                          type="password"
                          value={passwordForm.newPassword}
                          onChange={(event) =>
                            setPasswordForm((current) => ({
                              ...current,
                              newPassword: event.target.value
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="confirm-password" className="text-sm font-medium text-foreground">
                          Confirm new password
                        </label>
                        <Input
                          id="confirm-password"
                          type="password"
                          value={passwordForm.confirmPassword}
                          onChange={(event) =>
                            setPasswordForm((current) => ({
                              ...current,
                              confirmPassword: event.target.value
                            }))
                          }
                        />
                      </div>
                      <Button
                        onClick={handlePasswordSubmit}
                        disabled={rotatePasswordMutation.isPending}
                      >
                        {rotatePasswordMutation.isPending
                          ? "Updating password..."
                          : "Update password"}
                      </Button>
                    </>
                  ) : (
                    <div className="rounded-xl border p-4">
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
                  <CardTitle>Email Notification Preferences</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl border border-border/70 bg-white/70 p-4">
                    <p className="text-sm font-medium text-foreground">
                      Mandatory security notices
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Account-risk, security, and lifecycle restriction notices
                      remain enabled and are not customer-configurable.
                    </p>
                  </div>

                  {notificationNotice ? (
                    <Alert className="border-emerald-200 bg-emerald-50">
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
                      {[
                        {
                          key: "depositEmails" as const,
                          label: "Deposit emails",
                          description:
                            "Receive email updates when deposit requests are created, approved, or settled."
                        },
                        {
                          key: "withdrawalEmails" as const,
                          label: "Withdrawal emails",
                          description:
                            "Receive email updates for withdrawal review, execution, and settlement state changes."
                        },
                        {
                          key: "loanEmails" as const,
                          label: "Loan emails",
                          description:
                            "Receive servicing, repayment, grace-period, and managed lending status updates."
                        },
                        {
                          key: "productUpdateEmails" as const,
                          label: "Product updates",
                          description:
                            "Receive product notices about supported features and managed account changes."
                        }
                      ].map((item) => (
                        <div
                          key={item.key}
                          className="flex items-start justify-between gap-4 rounded-xl border p-4"
                        >
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-foreground">
                              {item.label}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {item.description}
                            </p>
                          </div>
                          <Switch
                            aria-label={item.label}
                            checked={notificationDraft[item.key]}
                            onCheckedChange={(checked) =>
                              setNotificationDraft((current) =>
                                current
                                  ? {
                                      ...current,
                                      [item.key]: checked
                                    }
                                  : current
                              )
                            }
                          />
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
                    <div className="rounded-xl border p-4">
                      <p className="text-sm font-medium text-foreground">
                        Notification preferences unavailable
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        This profile is currently read-only, so customer-editable
                        notification preferences are not available from this
                        portal yet.
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
