import { Suspense, lazy, type ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "@/components/routing/ProtectedRoute";
import { WebErrorBoundary } from "@/components/system/WebErrorBoundary";
import { WebI18nProvider } from "@/i18n/provider";
import { useT } from "@/i18n/use-t";
import {
  createWebQueryClient,
  installWebObservability
} from "@/lib/observability";
import { routerFuture } from "@/lib/router-future";

const Index = lazy(() => import("./pages/Index"));
const Transactions = lazy(() => import("./pages/Transactions"));
const Wallet = lazy(() => import("./pages/Wallet"));
const RetirementVault = lazy(() => import("./pages/RetirementVault"));
const Loans = lazy(() => import("./pages/Loans"));
const Profile = lazy(() => import("./pages/Profile"));
const Yield = lazy(() => import("./pages/Yield"));
const Notifications = lazy(() => import("./pages/Notifications"));
const TrustCenter = lazy(() => import("./pages/TrustCenter"));
const ProofVerification = lazy(() => import("./pages/ProofVerification"));
const SignIn = lazy(() => import("./pages/auth/SignIn"));
const SignUp = lazy(() => import("./pages/auth/SignUp"));

const queryClient = createWebQueryClient();

const RouteFallback = () => {
  const t = useT();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div
        aria-busy="true"
        aria-live="polite"
        className="stb-panel-shell w-full max-w-sm p-6 text-center"
      >
        <div className="mx-auto h-10 w-10 animate-pulse rounded-full bg-emerald-100 shadow-[0_0_0_10px_rgba(17,128,106,0.08)]" />
        <p className="mt-4 text-sm font-medium text-foreground">
          {t("app.loadingTitle")}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("app.loadingDescription")}
        </p>
      </div>
    </div>
  );
};

const withRouteBoundary = (element: ReactNode) => (
  <Suspense fallback={<RouteFallback />}>{element}</Suspense>
);

const App = () => (
  <WebI18nProvider>
    <WebErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <BrowserRouter future={routerFuture}>
            <WebObservabilityBridge />
            <Routes>
              <Route path="/auth/sign-in" element={withRouteBoundary(<SignIn />)} />
              <Route path="/auth/sign-up" element={withRouteBoundary(<SignUp />)} />
              <Route
                path="/trust/solvency"
                element={withRouteBoundary(<TrustCenter />)}
              />

              <Route
                path="/"
                element={
                  <ProtectedRoute>{withRouteBoundary(<Index />)}</ProtectedRoute>
                }
              />
              <Route
                path="/transactions"
                element={
                  <ProtectedRoute>{withRouteBoundary(<Transactions />)}</ProtectedRoute>
                }
              />
              <Route
                path="/wallet"
                element={
                  <ProtectedRoute>{withRouteBoundary(<Wallet />)}</ProtectedRoute>
                }
              />
              <Route
                path="/vault"
                element={
                  <ProtectedRoute>
                    {withRouteBoundary(<RetirementVault />)}
                  </ProtectedRoute>
                }
              />
              <Route
                path="/loans"
                element={
                  <ProtectedRoute>{withRouteBoundary(<Loans />)}</ProtectedRoute>
                }
              />
              <Route
                path="/yield"
                element={
                  <ProtectedRoute>{withRouteBoundary(<Yield />)}</ProtectedRoute>
                }
              />
              <Route path="/staking" element={<Navigate to="/yield" replace />} />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>{withRouteBoundary(<Profile />)}</ProtectedRoute>
                }
              />
              <Route
                path="/notifications"
                element={
                  <ProtectedRoute>
                    {withRouteBoundary(<Notifications />)}
                  </ProtectedRoute>
                }
              />
              <Route
                path="/proofs/me"
                element={
                  <ProtectedRoute>
                    {withRouteBoundary(<ProofVerification />)}
                  </ProtectedRoute>
                }
              />
              <Route
                path="/create-pool"
                element={<Navigate to="/yield" replace />}
              />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <Toaster />
            <Sonner />
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </WebErrorBoundary>
  </WebI18nProvider>
);

function WebObservabilityBridge() {
  useEffect(() => {
    installWebObservability();
  }, []);

  return null;
}

export default App;
