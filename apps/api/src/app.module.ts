import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { CustomerBalancesModule } from "./customer-balances/customer-balances.module";
import { EthereumModule } from "./ethereum/ethereum.module";
import { OversightIncidentsModule } from "./oversight-incidents/oversight-incidents.module";
import { PoolsModule } from "./pools/pools.module";
import { ReviewCasesModule } from "./review-cases/review-cases.module";
import { StakingPoolModule } from "./staking/staking.module";
import { TransactionIntentsModule } from "./transaction-intents/transaction-intents.module";
import { UserModule } from "./user/user.module";

@Module({
  imports: [
    AuthModule,
    UserModule,
    PoolsModule,
    StakingPoolModule,
    EthereumModule,
    TransactionIntentsModule,
    CustomerBalancesModule,
    ReviewCasesModule,
    OversightIncidentsModule
  ]
})
export class AppModule {}
