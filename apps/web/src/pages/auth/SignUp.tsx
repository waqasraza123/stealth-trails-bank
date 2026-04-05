import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LoadingButton } from "@/components/ui/loading-button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/ui/logo";
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-mint-50/20 p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Logo className="mx-auto mb-8" />
          <h2 className="mt-6 text-3xl font-bold tracking-tight">
            Create your account
          </h2>
        <p className="mt-2 text-sm text-muted-foreground">
            Create your banking profile
          </p>
        </div>
        <div className="glass-card mt-8 p-8">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                id="firstName"
                name="firstName"
                type="text"
                required
                className="mt-2"
                placeholder="First Name"
                value={formData.firstName}
                onChange={handleChange}
              />
              <Input
                id="lastName"
                name="lastName"
                type="text"
                required
                className="mt-2"
                placeholder="Last Name"
                value={formData.lastName}
                onChange={handleChange}
              />
            </div>
            <Input
              id="email"
              name="email"
              type="email"
              required
              className="mt-2"
              placeholder="Email"
              value={formData.email}
              onChange={handleChange}
            />
            <Input
              id="password"
              name="password"
              type="password"
              required
              className="mt-2"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <LoadingButton type="submit" className="w-full" loading={loading}>
              Create account
            </LoadingButton>
          </form>
        </div>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/auth/sign-in" className="text-mint-600 hover:text-mint-500">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default SignUp;
