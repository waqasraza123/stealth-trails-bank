import { Module } from "@nestjs/common";
import { InternalOperatorApiKeyGuard } from "../auth/guards/internal-operator-api-key.guard";
import { InternalOperatorBearerGuard } from "../auth/guards/internal-operator-bearer.guard";
import { InternalWorkerApiKeyGuard } from "../auth/guards/internal-worker-api-key.guard";
import { ApiRequestMetricsService } from "../logging/api-request-metrics.service";
import { PrismaService } from "../prisma/prisma.service";
import { ReviewCasesModule } from "../review-cases/review-cases.module";
import { OperationsMonitoringController } from "./operations-monitoring.controller";
import { OperationsMonitoringService } from "./operations-monitoring.service";
import { OperationsMonitoringWorkerController } from "./operations-monitoring-worker.controller";
import { PlatformAlertDeliveryService } from "./platform-alert-delivery.service";

@Module({
  imports: [ReviewCasesModule],
  controllers: [
    OperationsMonitoringController,
    OperationsMonitoringWorkerController
  ],
  providers: [
    OperationsMonitoringService,
    PlatformAlertDeliveryService,
    ApiRequestMetricsService,
    PrismaService,
    InternalOperatorApiKeyGuard,
    InternalOperatorBearerGuard,
    InternalWorkerApiKeyGuard
  ],
  exports: [OperationsMonitoringService, ApiRequestMetricsService]
})
export class OperationsMonitoringModule {}
