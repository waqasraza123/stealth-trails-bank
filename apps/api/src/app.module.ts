import { Module } from "@nestjs/common";
import { AuditEventsModule } from "./audit-events/audit-events.module";
import { AuthModule } from "./auth/auth.module";
import { CustomerAccountIncidentPackageModule } from "./customer-account-incident-package/customer-account-incident-package.module";
import { CustomerAccountOperationsModule } from "./customer-account-operations/customer-account-operations.module";
import { CustomerBalancesModule } from "./customer-balances/customer-balances.module";
import { EthereumModule } from "./ethereum/ethereum.module";
import { LedgerReconciliationModule } from "./ledger-reconciliation/ledger-reconciliation.module";
import { OperationsMonitoringModule } from "./operations-monitoring/operations-monitoring.module";
import { OversightIncidentsModule } from "./oversight-incidents/oversight-incidents.module";
import { PoolsModule } from "./pools/pools.module";
import { ReleaseReadinessModule } from "./release-readiness/release-readiness.module";
import { ReviewCasesModule } from "./review-cases/review-cases.module";
import { StakingPoolModule } from "./staking/staking.module";
import { SupportedAssetsModule } from "./supported-assets/supported-assets.module";
import { TransactionIntentsModule } from "./transaction-intents/transaction-intents.module";
import { TreasuryModule } from "./treasury/treasury.module";
import { UserModule } from "./user/user.module";

@Module({
  imports: [
    AuditEventsModule,
    AuthModule,
    UserModule,
    PoolsModule,
    StakingPoolModule,
    EthereumModule,
    LedgerReconciliationModule,
    OperationsMonitoringModule,
    SupportedAssetsModule,
    TreasuryModule,
    TransactionIntentsModule,
    ReleaseReadinessModule,
    CustomerBalancesModule,
    ReviewCasesModule,
    OversightIncidentsModule,
    CustomerAccountOperationsModule,
    CustomerAccountIncidentPackageModule
  ]
})
export class AppModule {}
