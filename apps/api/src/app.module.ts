import { Module } from "@nestjs/common";
import { AuditEventsModule } from "./audit-events/audit-events.module";
import { AuthModule } from "./auth/auth.module";
import { BalanceTransfersModule } from "./balance-transfers/balance-transfers.module";
import { ClientObservabilityModule } from "./client-observability/client-observability.module";
import { CustomerAccountIncidentPackageModule } from "./customer-account-incident-package/customer-account-incident-package.module";
import { CustomerAccountOperationsModule } from "./customer-account-operations/customer-account-operations.module";
import { CustomerBalancesModule } from "./customer-balances/customer-balances.module";
import { EthereumModule } from "./ethereum/ethereum.module";
import { GovernanceManifestsModule } from "./governance-manifests/governance-manifests.module";
import { GovernedExecutionModule } from "./governed-execution/governed-execution.module";
import { HealthModule } from "./health/health.module";
import { LedgerReconciliationModule } from "./ledger-reconciliation/ledger-reconciliation.module";
import { LoansModule } from "./loans/loans.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { OperationsMonitoringModule } from "./operations-monitoring/operations-monitoring.module";
import { OversightIncidentsModule } from "./oversight-incidents/oversight-incidents.module";
import { PoolsModule } from "./pools/pools.module";
import { ReleaseReadinessModule } from "./release-readiness/release-readiness.module";
import { RetirementVaultModule } from "./retirement-vault/retirement-vault.module";
import { ReviewCasesModule } from "./review-cases/review-cases.module";
import { StakingPoolModule } from "./staking/staking.module";
import { SupportedAssetsModule } from "./supported-assets/supported-assets.module";
import { SolvencyModule } from "./solvency/solvency.module";
import { TransactionIntentsModule } from "./transaction-intents/transaction-intents.module";
import { TreasuryModule } from "./treasury/treasury.module";
import { UserModule } from "./user/user.module";

@Module({
  imports: [
    HealthModule,
    AuditEventsModule,
    AuthModule,
    BalanceTransfersModule,
    ClientObservabilityModule,
    UserModule,
    PoolsModule,
    StakingPoolModule,
    SolvencyModule,
    GovernanceManifestsModule,
    GovernedExecutionModule,
    EthereumModule,
    LoansModule,
    NotificationsModule,
    LedgerReconciliationModule,
    OperationsMonitoringModule,
    SupportedAssetsModule,
    TreasuryModule,
    TransactionIntentsModule,
    ReleaseReadinessModule,
    RetirementVaultModule,
    CustomerBalancesModule,
    ReviewCasesModule,
    OversightIncidentsModule,
    CustomerAccountOperationsModule,
    CustomerAccountIncidentPackageModule
  ]
})
export class AppModule {}
