import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { CustomerBalancesModule } from "./customer-balances/customer-balances.module";
import { EthereumModule } from "./ethereum/ethereum.module";
import { PoolsModule } from "./pools/pools.module";
import { StakingModule } from "./staking/staking.module";
import { TransactionIntentsModule } from "./transaction-intents/transaction-intents.module";
import { UserModule } from "./user/user.module";

@Module({
  imports: [
    AuthModule,
    UserModule,
    PoolsModule,
    StakingModule,
    EthereumModule,
    TransactionIntentsModule,
    CustomerBalancesModule
  ]
})
export class AppModule {}
