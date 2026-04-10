import { loadWebRuntimeConfig } from "@stealth-trails-bank/config/web";
import {
  getSystemHealthLabel,
  inferSystemHealthStatus
} from "@stealth-trails-bank/ui-foundation";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation
} from "react-router-dom";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ConsoleShell } from "@/components/console/ConsoleShell";
import { SessionCard } from "@/components/console/SessionCard";
import { AdminI18nProvider } from "@/i18n/provider";
import { useLocale } from "@/i18n/use-locale";
import { useT } from "@/i18n/use-t";
import { getOperationsStatus, getReleaseReadinessSummary } from "@/lib/api";
import { useOperatorSession } from "@/state/operator-session";
import { OperatorSessionProvider } from "@/state/operator-session";
import { AlertsPage } from "@/pages/AlertsPage";
import { AuditPage } from "@/pages/AuditPage";
import { AccountsPage } from "@/pages/AccountsPage";
import { LaunchReadinessPage } from "@/pages/LaunchReadinessPage";
import { OperationsPage } from "@/pages/OperationsPage";
import { QueuesPage } from "@/pages/QueuesPage";
import { ReconciliationPage } from "@/pages/ReconciliationPage";
import { TreasuryPage } from "@/pages/TreasuryPage";
import { buildSystemHealthTone } from "@/pages/shared";

const runtimeConfig = loadWebRuntimeConfig(import.meta.env);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false
    }
  }
});

const navItems = [
  { label: "Operations Overview", path: "/operations" },
  { label: "Queues", path: "/queues" },
  { label: "Accounts & Reviews", path: "/accounts" },
  { label: "Reconciliation", path: "/reconciliation" },
  { label: "Treasury", path: "/treasury" },
  { label: "Alerts & Incidents", path: "/alerts" },
  { label: "Audit Trail", path: "/audit" },
  { label: "Launch Readiness", path: "/launch-readiness" }
];

function App() {
  return (
    <AdminI18nProvider>
      <QueryClientProvider client={queryClient}>
          <OperatorSessionProvider serverUrl={runtimeConfig.serverUrl}>
          <BrowserRouter
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true
            }}
          >
            <AdminConsole />
          </BrowserRouter>
        </OperatorSessionProvider>
      </QueryClientProvider>
    </AdminI18nProvider>
  );
}

function AdminConsole() {
  const { locale } = useLocale();
  const t = useT();
  const location = useLocation();
  const { configuredSession } = useOperatorSession();

  const operationsStatusQuery = useQuery({
    queryKey: ["shell-operations-status", configuredSession?.baseUrl],
    queryFn: () => getOperationsStatus(configuredSession!, { recentAlertLimit: 4 }),
    enabled: Boolean(configuredSession)
  });

  const releaseReadinessQuery = useQuery({
    queryKey: ["shell-release-readiness", configuredSession?.baseUrl],
    queryFn: () => getReleaseReadinessSummary(configuredSession!),
    enabled: Boolean(configuredSession)
  });

  const degradedServices = [
    operationsStatusQuery.data?.workerHealth.status,
    operationsStatusQuery.data?.queueHealth.status,
    operationsStatusQuery.data?.chainHealth.status,
    operationsStatusQuery.data?.treasuryHealth.status,
    operationsStatusQuery.data?.reconciliationHealth.status,
    operationsStatusQuery.data?.incidentSafety.status
  ].filter((status) => status === "warning" || status === "critical").length;

  const blockedWorkflows =
    (operationsStatusQuery.data?.alertSummary.criticalCount ?? 0) +
    ((operationsStatusQuery.data?.queueHealth.agedQueuedCount ?? 0) > 0 ? 1 : 0);

  const systemHealth = inferSystemHealthStatus({
    releaseBlocked: releaseReadinessQuery.data?.overallStatus === "critical",
    blockedWorkflows,
    degradedServices
  });

  const routeLabel =
    navItems.find((item) => location.pathname.startsWith(item.path))?.label ??
    navItems[0].label;

  return (
    <ConsoleShell
      navItems={navItems}
      routeLabel={routeLabel}
      heading={t("hero.title")}
      description={t("hero.description")}
      healthLabel={getSystemHealthLabel(systemHealth, locale)}
      healthTone={buildSystemHealthTone(
        operationsStatusQuery.data,
        releaseReadinessQuery.data?.overallStatus === "critical"
      )}
      incidentCount={operationsStatusQuery.data?.incidentSafety.openOversightIncidentCount ?? 0}
      operatorLabel={
        configuredSession
          ? `${configuredSession.operatorId} · ${configuredSession.operatorRole}`
          : locale === "ar"
            ? "جلسة غير محفوظة"
            : "Session not saved"
      }
      environmentLabel={configuredSession ? configuredSession.baseUrl : runtimeConfig.serverUrl}
      topActions={<LanguageSwitcher />}
      sidebar={<SessionCard />}
    >
      <Routes>
        <Route path="/" element={<Navigate to="/operations" replace />} />
        <Route path="/operations" element={<OperationsPage />} />
        <Route path="/queues" element={<QueuesPage />} />
        <Route path="/accounts" element={<AccountsPage />} />
        <Route path="/reconciliation" element={<ReconciliationPage />} />
        <Route path="/treasury" element={<TreasuryPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/audit" element={<AuditPage />} />
        <Route path="/launch-readiness" element={<LaunchReadinessPage />} />
        <Route path="*" element={<Navigate to="/operations" replace />} />
      </Routes>
    </ConsoleShell>
  );
}

export default App;
