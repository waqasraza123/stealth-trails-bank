import { Module } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SupportedAssetsController } from "./supported-assets.controller";
import { SupportedAssetsService } from "./supported-assets.service";

@Module({
  controllers: [SupportedAssetsController],
  providers: [SupportedAssetsService, PrismaService]
})
export class SupportedAssetsModule {}
