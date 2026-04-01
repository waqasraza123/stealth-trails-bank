import { Module } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CustomerBalancesController } from "./customer-balances.controller";
import { CustomerBalancesService } from "./customer-balances.service";

@Module({
  controllers: [CustomerBalancesController],
  providers: [CustomerBalancesService, PrismaService]
})
export class CustomerBalancesModule {}
