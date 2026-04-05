import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LoadingButton } from "@/components/ui/loading-button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/ui/logo";
import useAuth from "@/hooks/auth/useAuth";
import { toast } from "@/components/ui/use-toast";
import { useUserStore } from "@/stores/userStore";

const SignIn = () => {
  const { login, loading, error } = useAuth();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const navigate = useNavigate();
  const token = useUserStore((state) => state.token);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(formData);
      toast({
        title: "Login successful!",
        description: "Welcome back to your account!",
      });
      navigate("/");
    } catch {
      toast({
        title: "Login failed",
        description: error || "An error occurred during login. Please try again.",
      });
    }
  };

  useEffect(() => {
    if (token) {
      navigate("/");
    }
  }, [token, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-mint-50/20 p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Logo className="flex justify-center mb-8" />
          <h2 className="mt-6 text-3xl font-bold tracking-tight">Welcome back</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to access your account
          </p>
        </div>
        <div className="glass-card mt-8 p-8">
          <form className="space-y-6" onSubmit={handleSubmit}>
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
              Sign in
            </LoadingButton>
          </form>
        </div>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Link to="/auth/sign-up" className="text-mint-600 hover:text-mint-500">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
};

export default SignIn;
