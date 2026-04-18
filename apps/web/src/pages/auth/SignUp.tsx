import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthShell } from "@/components/auth/AuthShell";
import {
  getAuthCredibilityChips,
  getSignUpCopy,
} from "@/components/auth/auth-content";
import { LoadingButton } from "@/components/ui/loading-button";
import { Input } from "@/components/ui/input";
import { useLocale } from "@/i18n/use-locale";
import { useT } from "@/i18n/use-t";
import { toast } from "@/components/ui/use-toast";
import useAuth from "@/hooks/auth/useAuth";
import { useUserStore } from "@/stores/userStore";

const SignUp = () => {
  const { signup, loading, error } = useAuth();
  const t = useT();
  const { locale } = useLocale();
  const signUpCopy = getSignUpCopy(t);
  const authCredibilityChips = getAuthCredibilityChips(t);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  });
  const token = useUserStore((state) => state.token);
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signup(formData);
      toast({
        title: t("auth.signUp.successTitle"),
        description: t("auth.signUp.successDescription"),
      });
      navigate("/auth/sign-in");
    } catch {
      toast({
        title: t("auth.signUp.errorTitle"),
        description: error || t("auth.signUp.errorDescription"),
      });
    }
  };

  useEffect(() => {
    if (token) {
      navigate("/");
    }
  }, [navigate, token]);

  return (
    <AuthShell
      formEyebrow={signUpCopy.formEyebrow}
      formTitle={signUpCopy.formTitle}
      formDescription={signUpCopy.formDescription}
      brandEyebrow={signUpCopy.brandEyebrow}
      brandTitle={signUpCopy.brandTitle}
      brandDescription={signUpCopy.brandDescription}
      chips={authCredibilityChips}
      footer={
        <div className="space-y-2 text-center">
          <p>
            {t("auth.signUp.footerPrefix")}{" "}
            <Link
              to="/auth/sign-in"
              className="font-semibold text-auth-form-accent transition-colors hover:text-[hsl(var(--auth-form-foreground))]"
            >
              {t("auth.signUp.footerLink")}
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
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <label
              htmlFor="firstName"
              className="text-sm font-medium text-auth-form-foreground"
            >
              {t("auth.signUp.firstNameLabel")}
            </label>
            <Input
              id="firstName"
              name="firstName"
              type="text"
              autoComplete="given-name"
              required
              className="auth-input"
              placeholder={t("auth.signUp.firstNamePlaceholder")}
              value={formData.firstName}
              onChange={handleChange}
              aria-invalid={Boolean(error)}
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="lastName"
              className="text-sm font-medium text-auth-form-foreground"
            >
              {t("auth.signUp.lastNameLabel")}
            </label>
            <Input
              id="lastName"
              name="lastName"
              type="text"
              autoComplete="family-name"
              required
              className="auth-input"
              placeholder={t("auth.signUp.lastNamePlaceholder")}
              value={formData.lastName}
              onChange={handleChange}
              aria-invalid={Boolean(error)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="email"
            className="text-sm font-medium text-auth-form-foreground"
          >
            {t("auth.signUp.emailLabel")}
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="auth-input"
            placeholder={t("auth.signUp.emailPlaceholder")}
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
              {t("auth.signUp.passwordLabel")}
            </label>
            <span className="text-xs text-auth-form-muted">{t("auth.signUp.passwordHint")}</span>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            className="auth-input"
            placeholder={t("auth.signUp.passwordPlaceholder")}
            value={formData.password}
            onChange={handleChange}
            aria-invalid={Boolean(error)}
          />
          <p className="text-xs leading-6 text-auth-form-muted">
            {t("auth.signUp.passwordHelp")}
          </p>
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
          {t("auth.signUp.submit")}
        </LoadingButton>
      </form>
    </AuthShell>
  );
};

export default SignUp;
