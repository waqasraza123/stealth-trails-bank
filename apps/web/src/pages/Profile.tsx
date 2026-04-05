import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { useGetUser } from "@/hooks/user/useGetUser";
import {
  formatAccountStatusLabel,
  getAccountLifecycleEntries,
  getAccountStatusBadgeTone,
  getAccountStatusSummary
} from "@/lib/customer-account";
import { formatDateLabel } from "@/lib/customer-finance";
import { useUserStore } from "@/stores/userStore";

const Profile = () => {
  const navigate = useNavigate();
  const userFromStore = useUserStore((state) => state.user);
  const clearUser = useUserStore((state) => state.clearUser);
  const profileQuery = useGetUser(userFromStore?.supabaseUserId);
  const profile = profileQuery.data;

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
    "Customer";
  const lifecycleEntries = profile
    ? getAccountLifecycleEntries(profile)
    : [];

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
                  {formatAccountStatusLabel(profile?.accountStatus)}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{fullName}</p>
              <p className="text-sm text-muted-foreground">
                {profile?.email ?? userFromStore?.email ?? "No profile email loaded."}
              </p>
            </div>
          </div>
          <Button variant="destructive" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>

        {profileQuery.isError || !profile ? (
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Failed to load customer profile</AlertTitle>
            <AlertDescription>
              {profileQuery.error instanceof Error
                ? profileQuery.error.message
                : "The customer profile projection could not be loaded."}
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <Alert className="border-apple-blue bg-apple-soft-blue">
              <Shield className="h-4 w-4" />
              <AlertTitle>Truthful managed-account security surface</AlertTitle>
              <AlertDescription>
                This page shows real account identity, lifecycle status, and
                wallet linkage. Fake browser wallet linking, profile-image
                uploads, notification toggles, and password forms have been
                removed until customer-safe APIs exist for them.
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
                      {getAccountStatusSummary(profile.accountStatus)}
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Customer ID
                      </p>
                      <p className="mt-2 font-medium text-foreground">
                        {profile.customerId ?? "Not provisioned"}
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
                            {entry.value ? formatDateLabel(entry.value) : "Not recorded"}
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
                    currently marked as {formatAccountStatusLabel(profile.accountStatus)}.
                  </p>
                </div>
                <div className="rounded-xl border p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <ShieldAlert className="h-4 w-4 text-orange-600" />
                    Password Management
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Self-service password rotation is not exposed by the current
                    customer API, so the previous browser form was removed.
                  </p>
                </div>
                <div className="rounded-xl border p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <ShieldAlert className="h-4 w-4 text-orange-600" />
                    Notifications
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Notification preferences are not yet customer-configurable,
                    so the old configure buttons were replaced with this
                    truthful availability notice.
                  </p>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
};

export default Profile;
