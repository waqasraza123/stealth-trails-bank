import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthShell } from "@/components/auth/AuthShell";
import { getAuthCredibilityChips, getSignInCopy } from "@/components/auth/auth-content";
import { LoadingButton } from "@/components/ui/loading-button";
import { Input } from "@/components/ui/input";
import { useT } from "@/i18n/use-t";
import useAuth, { type LoginFlowResult } from "@/hooks/auth/useAuth";
import { useUserStore } from "@/stores/userStore";

export default function SignIn() {
  const auth = useAuth();
  const t = useT();
  const copy = getSignInCopy(t);
  const navigate = useNavigate();
  const token = useUserStore((state) => state.token);
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [flow, setFlow] = useState<LoginFlowResult | null>(null);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);

  useEffect(() => {
    if (token) navigate("/", { replace: true });
  }, [navigate, token]);

  async function continueFlow(next: LoginFlowResult) {
    if (next.nextAction === "complete") {
      setFlow(next);
      return;
    }
    if (next.nextAction === "enroll_totp" && !next.secret) {
      setFlow(await auth.startTotpEnrollment(next.flowId));
      return;
    }
    setFlow(next);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!flow) {
      await continueFlow(await auth.login(credentials));
      return;
    }
    if (flow.nextAction === "verify_email") {
      await auth.verifyEmail(credentials.email, code);
      setFlow(null);
      setCode("");
      return;
    }
    if (flow.nextAction === "enroll_totp") {
      await continueFlow(await auth.verifyTotpEnrollment(flow.flowId, code));
      setCode("");
      return;
    }
    if (flow.nextAction === "verify_totp") {
      await continueFlow(
        useRecovery
          ? await auth.verifyRecoveryCode(flow.flowId, code)
          : await auth.verifyTotp(flow.flowId, code),
      );
      setCode("");
      return;
    }
    if (flow.nextAction === "upgrade_password") {
      await continueFlow(await auth.upgradePassword(flow.flowId, newPassword));
      setNewPassword("");
      return;
    }
    if (flow.nextAction === "setup_recovery_codes") {
      await continueFlow(await auth.setupRecoveryCodes(flow.flowId));
    }
  }

  const challenge = flow?.nextAction;
  return (
    <AuthShell
      formEyebrow={copy.formEyebrow}
      formTitle={challenge ? "Security check" : copy.formTitle}
      formDescription={challenge ? "Complete every required control before account access is granted." : copy.formDescription}
      brandEyebrow={copy.brandEyebrow}
      brandTitle={copy.brandTitle}
      brandDescription={copy.brandDescription}
      chips={getAuthCredibilityChips(t)}
      footer={<Link to="/auth/sign-up" className="font-semibold text-auth-form-accent">{t("auth.signIn.footerLink")}</Link>}
    >
      <form className="space-y-5" onSubmit={(event) => void submit(event)}>
        {!flow ? (
          <>
            <label className="block space-y-2" htmlFor="email">
              <span className="text-sm font-medium">{t("auth.signIn.emailLabel")}</span>
              <Input id="email" name="email" type="email" autoComplete="email" required value={credentials.email} onChange={(e) => setCredentials({ ...credentials, email: e.target.value })} />
            </label>
            <label className="block space-y-2" htmlFor="password">
              <span className="text-sm font-medium">{t("auth.signIn.passwordLabel")}</span>
              <Input id="password" name="password" type="password" autoComplete="current-password" required value={credentials.password} onChange={(e) => setCredentials({ ...credentials, password: e.target.value })} />
            </label>
          </>
        ) : challenge === "upgrade_password" ? (
          <label className="block space-y-2" htmlFor="newPassword">
            <span className="text-sm font-medium">Create a stronger password</span>
            <Input id="newPassword" type="password" autoComplete="new-password" minLength={15} maxLength={128} required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            <span className="block text-xs text-auth-form-muted">Use at least 15 characters. Common or personal passwords are blocked.</span>
          </label>
        ) : challenge === "setup_recovery_codes" ? (
          <p className="rounded-2xl border p-4 text-sm">Generate one-time recovery codes now. Store them offline; they will only be shown once.</p>
        ) : (
          <>
            {challenge === "enroll_totp" && flow.secret ? (
              <div className="space-y-2 rounded-2xl border p-4 text-sm">
                <p>Add this account to your authenticator app, then enter its current code.</p>
                <code className="block break-all font-mono">{flow.secret}</code>
              </div>
            ) : null}
            {challenge === "verify_email" ? <p className="text-sm">Enter the 8-digit code sent to {credentials.email}. Then sign in again to continue.</p> : null}
            {challenge === "verify_totp" ? (
              <button type="button" className="text-sm font-semibold underline" onClick={() => { setUseRecovery(!useRecovery); setCode(""); }}>
                {useRecovery ? "Use authenticator code" : "Use a recovery code"}
              </button>
            ) : null}
            <label className="block space-y-2" htmlFor="securityCode">
              <span className="text-sm font-medium">{useRecovery ? "Recovery code" : "Security code"}</span>
              <Input id="securityCode" inputMode={useRecovery ? "text" : "numeric"} autoComplete="one-time-code" required value={code} onChange={(e) => setCode(e.target.value)} />
            </label>
          </>
        )}

        {flow?.recoveryCodes?.length ? (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4" role="status">
            <p className="font-semibold">Save these recovery codes before continuing</p>
            <pre className="mt-3 whitespace-pre-wrap font-mono text-sm">{flow.recoveryCodes.join("\n")}</pre>
          </div>
        ) : null}
        {auth.error ? <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{auth.error}</div> : null}
        <LoadingButton type="submit" className="h-12 w-full rounded-2xl" loading={auth.loading}>
          {challenge === "setup_recovery_codes" ? "Generate recovery codes" : challenge ? "Continue securely" : t("auth.signIn.submit")}
        </LoadingButton>
      </form>
    </AuthShell>
  );
}
