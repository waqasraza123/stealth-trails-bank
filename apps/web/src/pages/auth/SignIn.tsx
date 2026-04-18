import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronDown, KeyRound } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import {
  getAuthCredibilityChips,
  getSignInCopy,
} from "@/components/auth/auth-content";
import { LoadingButton } from "@/components/ui/loading-button";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/use-locale";
import { useT } from "@/i18n/use-t";
import useAuth from "@/hooks/auth/useAuth";
import { toast } from "@/components/ui/use-toast";
import { useUserStore } from "@/stores/userStore";

const sharedLoginCredentials = {
  email: "admin@gmail.com",
  password: "P@ssw0rd",
};

const SignIn = () => {
  const { login, loading, error } = useAuth();
  const t = useT();
  const { locale } = useLocale();
  const signInCopy = getSignInCopy(t);
  const authCredibilityChips = getAuthCredibilityChips(t);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [showSharedAccess, setShowSharedAccess] = useState(false);
  const navigate = useNavigate();
  const token = useUserStore((state) => state.token);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const useSharedLogin = () => {
    setFormData(sharedLoginCredentials);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(formData);
      toast({
        title: t("auth.signIn.successTitle"),
        description: t("auth.signIn.successDescription"),
      });
      navigate("/");
    } catch {
      toast({
        title: t("auth.signIn.errorTitle"),
        description: error || t("auth.signIn.errorDescription"),
      });
    }
  };

  useEffect(() => {
    if (token) {
      navigate("/");
    }
  }, [token, navigate]);

  return (
    <AuthShell
      formEyebrow={signInCopy.formEyebrow}
      formTitle={signInCopy.formTitle}
      formDescription={signInCopy.formDescription}
      brandEyebrow={signInCopy.brandEyebrow}
      brandTitle={signInCopy.brandTitle}
      brandDescription={signInCopy.brandDescription}
      chips={authCredibilityChips}
      footer={
        <div className="space-y-2 text-center">
          <p>
            {t("auth.signIn.footerPrefix")}{" "}
            <Link
              to="/auth/sign-up"
              className="font-semibold text-auth-form-accent transition-colors hover:text-[hsl(var(--auth-form-foreground))]"
            >
              {t("auth.signIn.footerLink")}
            </Link>
          </p>
          <p>
            <Link
              to="/trust/solvency"
              className="font-semibold text-auth-form-accent transition-colors hover:text-[hsl(var(--auth-form-foreground))]"
            >
              {locale === "ar"
                ? "عرض مركز الثقة العام"
                : "View the public trust center"}
            </Link>
          </p>
        </div>
      }
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label
            htmlFor="email"
            className="text-sm font-medium text-auth-form-foreground"
          >
            {t("auth.signIn.emailLabel")}
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="auth-input"
            placeholder={t("auth.signIn.emailPlaceholder")}
            value={formData.email}
            onChange={handleChange}
            aria-invalid={Boolean(error)}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <label
              htmlFor="password"
              className="text-sm font-medium text-auth-form-foreground"
            >
              {t("auth.signIn.passwordLabel")}
            </label>
            <span className="text-xs text-auth-form-muted">
              {t("auth.signIn.passwordHint")}
            </span>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="auth-input"
            placeholder={t("auth.signIn.passwordPlaceholder")}
            value={formData.password}
            onChange={handleChange}
            aria-invalid={Boolean(error)}
          />
        </div>

        {error ? (
          <div
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        ) : null}

        <LoadingButton
          type="submit"
          className="h-12 w-full rounded-2xl bg-[hsl(var(--auth-form-foreground))] text-base font-semibold text-[hsl(var(--auth-form-background))] shadow-[0_18px_45px_rgba(8,17,28,0.18)] transition-opacity hover:bg-[hsl(var(--auth-form-foreground))] hover:opacity-95"
          loading={loading}
        >
          {t("auth.signIn.submit")}
        </LoadingButton>
      </form>

      <div className="mt-6 rounded-2xl border border-[rgba(10,18,30,0.08)] bg-black/[0.025] p-4">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 text-left"
          aria-expanded={showSharedAccess}
          onClick={() => setShowSharedAccess((current) => !current)}
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full border border-[rgba(10,18,30,0.08)] bg-[rgba(255,255,255,0.7)] p-2 text-auth-form-accent">
              <KeyRound className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-auth-form-foreground">
                {t("auth.signIn.demoTitle")}
              </p>
              <p className="mt-1 text-sm text-auth-form-muted">
                {t("auth.signIn.demoDescription")}
              </p>
            </div>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-auth-form-muted transition-transform ${
              showSharedAccess ? "rotate-180" : ""
            }`}
          />
        </button>

        {showSharedAccess ? (
          <div className="mt-4 rounded-2xl border border-[rgba(18,115,103,0.18)] bg-[rgba(255,255,255,0.72)] p-4 text-sm">
            <p className="font-medium text-auth-form-foreground">
              {t("auth.signIn.demoPanelTitle")}
            </p>
            <p className="mt-2 text-auth-form-muted">
              {t("auth.signIn.emailLabel")}: <span className="font-semibold text-auth-form-foreground">admin@gmail.com</span>
            </p>
            <p className="text-auth-form-muted">
              {t("auth.signIn.passwordLabel")}: <span className="font-semibold text-auth-form-foreground">P@ssw0rd</span>
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-4 h-11 w-full rounded-2xl border-black/10 bg-white/80 font-semibold text-auth-form-foreground hover:bg-[hsl(var(--auth-form-accent))] hover:text-[hsl(var(--auth-form-background))]"
              onClick={useSharedLogin}
            >
              {t("auth.signIn.demoButton")}
            </Button>
          </div>
        ) : null}
      </div>
    </AuthShell>
  );
};

export default SignIn;
