import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthShell } from "@/components/auth/AuthShell";
import {
  authCredibilityChips,
  signUpCopy,
} from "@/components/auth/auth-content";
import { LoadingButton } from "@/components/ui/loading-button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import useAuth from "@/hooks/auth/useAuth";
import { useUserStore } from "@/stores/userStore";

const SignUp = () => {
  const { signup, loading, error } = useAuth();
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
        title: "Account created",
        description: "Sign in to continue.",
      });
      navigate("/auth/sign-in");
    } catch {
      toast({
        title: "Sign-up failed",
        description: error || "An error occurred during sign-up. Please try again.",
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
        <p className="text-center">
          Already have an account?{" "}
          <Link
            to="/auth/sign-in"
            className="font-semibold text-auth-form-accent transition-colors hover:text-[hsl(var(--auth-form-foreground))]"
          >
            Sign in
          </Link>
        </p>
      }
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <label
              htmlFor="firstName"
              className="text-sm font-medium text-auth-form-foreground"
            >
              First name
            </label>
            <Input
              id="firstName"
              name="firstName"
              type="text"
              autoComplete="given-name"
              required
              className="auth-input"
              placeholder="Amina"
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
              Last name
            </label>
            <Input
              id="lastName"
              name="lastName"
              type="text"
              autoComplete="family-name"
              required
              className="auth-input"
              placeholder="Rahman"
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
            Email address
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="auth-input"
            placeholder="you@example.com"
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
              Password
            </label>
            <span className="text-xs text-auth-form-muted">Store it in a password manager</span>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            className="auth-input"
            placeholder="Create a strong password"
            value={formData.password}
            onChange={handleChange}
            aria-invalid={Boolean(error)}
          />
          <p className="text-xs leading-6 text-auth-form-muted">
            Use a strong, unique password for your banking profile. Managed wallet access is attached after account creation.
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
          Create secure account
        </LoadingButton>
      </form>
    </AuthShell>
  );
};

export default SignUp;
