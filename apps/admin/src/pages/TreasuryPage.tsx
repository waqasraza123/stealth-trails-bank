import { useQuery } from "@tanstack/react-query";
import { getTreasuryOverview } from "@/lib/api";
import { formatCount, formatDateTime, shortenValue } from "@/lib/format";
import {
  AdminStatusBadge,
  ErrorState,
  InlineNotice,
  LoadingState,
  MetricCard,
  SectionPanel
} from "@/components/console/primitives";
import { mapStatusToTone, useConfiguredSessionGuard } from "./shared";

export function TreasuryPage() {
  const { session, fallback } = useConfiguredSessionGuard();

  const treasuryQuery = useQuery({
    queryKey: ["treasury-overview", session?.baseUrl],
    queryFn: () => getTreasuryOverview(session!, { recentLimit: 10 }),
    enabled: Boolean(session)
  });

  if (fallback) {
    return fallback;
  }

  if (treasuryQuery.isLoading) {
    return (
      <LoadingState
        title="Loading treasury visibility"
        description="Wallet coverage, worker posture, and treasury-linked activity are loading."
      />
    );
  }

  if (treasuryQuery.isError) {
    return (
      <ErrorState
        title="Treasury visibility unavailable"
        description="Treasury coverage and wallet inventory could not be loaded."
      />
    );
  }

  const treasury = treasuryQuery.data!;

  return (
    <div className="admin-page-grid">
      <SectionPanel
        title="Treasury visibility"
        description="Wallet coverage, operational inventory, and recent treasury-linked activity."
      >
        <InlineNotice
          title="Coverage posture"
          description={`Coverage is ${treasury.coverage.status}. Generated ${formatDateTime(
            treasury.generatedAt
          )}.`}
          tone={mapStatusToTone(treasury.coverage.status)}
        />
        <div className="admin-metrics-grid compact">
          <MetricCard
            label="Treasury wallets"
            value={formatCount(treasury.coverage.activeTreasuryWalletCount)}
            detail={`${formatCount(treasury.coverage.activeOperationalWalletCount)} operational`}
          />
          <MetricCard
            label="Linked wallets"
            value={formatCount(treasury.coverage.customerLinkedWalletCount)}
            detail="Wallets attached to a customer account"
          />
          <MetricCard
            label="Treasury alerts"
            value={formatCount(treasury.coverage.openTreasuryAlertCount)}
            detail={`Generated ${formatDateTime(treasury.generatedAt)}`}
          />
        </div>
      </SectionPanel>

      <SectionPanel
        title="Wallet inventory"
        description="Managed treasury and operational wallets."
      >
        <div className="admin-list-card">
          <div className="admin-list">
            {treasury.wallets.map((wallet) => (
              <div key={wallet.id} className="admin-list-row">
                <strong>{shortenValue(wallet.address)}</strong>
                <span>{wallet.kind}</span>
                <span>
                  <AdminStatusBadge
                    label={wallet.status}
                    tone={mapStatusToTone(wallet.status)}
                  />
                </span>
              </div>
            ))}
          </div>
        </div>
      </SectionPanel>

      <SectionPanel
        title="Recent activity"
        description="Latest treasury-linked customer intents and alerts."
      >
        <div className="admin-two-column">
          <div className="admin-list-card">
            <h3>Intents</h3>
            <div className="admin-list">
              {treasury.recentActivity.map((activity) => (
                <div key={activity.transactionIntentId} className="admin-list-row">
                  <strong>{activity.asset.symbol}</strong>
                  <span>{activity.intentType}</span>
                  <span>{activity.status}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="admin-list-card">
            <h3>Alerts</h3>
            <div className="admin-list">
              {treasury.recentAlerts.map((alert) => (
                <div key={alert.id} className="admin-list-row">
                  <strong>{alert.summary}</strong>
                  <span>{alert.severity}</span>
                  <span>{alert.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SectionPanel>
    </div>
  );
}
