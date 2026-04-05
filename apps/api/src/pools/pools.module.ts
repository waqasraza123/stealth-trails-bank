import { Module } from "@nestjs/common";
import { InternalOperatorApiKeyGuard } from "../auth/guards/internal-operator-api-key.guard";
import { AuthService } from "../auth/auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { PoolsController } from "./pools.controller";
import { PoolsService } from "./pools.service";

@Module({
    controllers: [PoolsController],
    providers: [PoolsService, PrismaService, AuthService, InternalOperatorApiKeyGuard],
})
export class PoolsModule { }
