import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
  ValidationPipe
} from "@nestjs/common";
import { InternalOperatorBearerGuard } from "../auth/guards/internal-operator-bearer.guard";
import { ApiRequestMetricsService } from "../logging/api-request-metrics.service";
import { CustomJsonResponse } from "../types/CustomJsonResponse";
import { AcknowledgePlatformAlertDto } from "./dto/acknowledge-platform-alert.dto";
import { AssignPlatformAlertOwnerDto } from "./dto/assign-platform-alert-owner.dto";
import { ClearPlatformAlertSuppressionDto } from "./dto/clear-platform-alert-suppression.dto";
import { GetOperationsMetricsDto } from "./dto/get-operations-metrics.dto";
import { GetOperationsStatusDto } from "./dto/get-operations-status.dto";
import { ListPlatformAlertDeliveryTargetHealthDto } from "./dto/list-platform-alert-delivery-target-health.dto";
import { ListPlatformAlertsDto } from "./dto/list-platform-alerts.dto";
import { ListWorkerRuntimeHealthDto } from "./dto/list-worker-runtime-health.dto";
import { ReEscalateCriticalPlatformAlertsDto } from "./dto/re-escalate-critical-platform-alerts.dto";
import { RetryPlatformAlertDeliveriesDto } from "./dto/retry-platform-alert-deliveries.dto";
import { RouteCriticalPlatformAlertsDto } from "./dto/route-critical-platform-alerts.dto";
import { RoutePlatformAlertToReviewCaseDto } from "./dto/route-platform-alert-to-review-case.dto";
import { SuppressPlatformAlertDto } from "./dto/suppress-platform-alert.dto";
import { OperationsMonitoringService } from "./operations-monitoring.service";

type InternalOperatorRequest = {
  internalOperator: {
    operatorId: string;
    operatorRole?: string;
  };
};

@UseGuards(InternalOperatorBearerGuard)
@Controller("operations/internal")
export class OperationsMonitoringController {
  constructor(
    private readonly operationsMonitoringService: OperationsMonitoringService,
    private readonly apiRequestMetricsService: ApiRequestMetricsService
  ) {}

  @Get("status")
  async getOperationsStatus(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: GetOperationsStatusDto
  ): Promise<CustomJsonResponse> {
    const result = await this.operationsMonitoringService.getOperationsStatus(
      query
    );

    return {
      status: "success",
      message: "Operations status retrieved successfully.",
      data: result
    };
  }

  @Get("alerts")
  async listPlatformAlerts(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: ListPlatformAlertsDto
  ): Promise<CustomJsonResponse> {
    const result = await this.operationsMonitoringService.listPlatformAlerts(
      query
    );

    return {
      status: "success",
      message: "Platform alerts retrieved successfully.",
      data: result
    };
  }

  @Get("alerts/delivery-target-health")
  async listPlatformAlertDeliveryTargetHealth(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: ListPlatformAlertDeliveryTargetHealthDto
  ): Promise<CustomJsonResponse> {
    const result =
      await this.operationsMonitoringService.listPlatformAlertDeliveryTargetHealth(
        query
      );

    return {
      status: "success",
      message: "Platform alert delivery target health retrieved successfully.",
      data: result
    };
  }

  @Post("alerts/route-critical")
  async routeCriticalPlatformAlerts(
    @Body(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: RouteCriticalPlatformAlertsDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.operationsMonitoringService.routeCriticalPlatformAlerts(
      request.internalOperator.operatorId,
      dto
    );

    return {
      status: "success",
      message:
        result.routedAlerts.length > 0
          ? "Critical platform alerts routed successfully."
          : "No unrouted critical platform alerts required routing.",
      data: result
    };
  }

  @Post("alerts/re-escalate-critical")
  async reEscalateCriticalPlatformAlerts(
    @Body(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: ReEscalateCriticalPlatformAlertsDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result =
      await this.operationsMonitoringService.reEscalateCriticalPlatformAlerts(
        request.internalOperator.operatorId,
        dto
      );

    return {
      status: "success",
      message:
        result.reEscalatedAlertCount > 0
          ? "Overdue critical platform alerts re-escalated successfully."
          : "No overdue critical platform alerts required re-escalation.",
      data: result
    };
  }

  @Post("alerts/:alertId/assign-owner")
  async assignPlatformAlertOwner(
    @Param("alertId") alertId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: AssignPlatformAlertOwnerDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.operationsMonitoringService.assignPlatformAlertOwner(
      alertId,
      request.internalOperator.operatorId,
      dto.ownerOperatorId,
      dto.note
    );

    return {
      status: "success",
      message: result.stateReused
        ? "Platform alert owner assignment already matched the requested state."
        : "Platform alert owner assigned successfully.",
      data: result
    };
  }

  @Post("alerts/:alertId/acknowledge")
  async acknowledgePlatformAlert(
    @Param("alertId") alertId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: AcknowledgePlatformAlertDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.operationsMonitoringService.acknowledgePlatformAlert(
      alertId,
      request.internalOperator.operatorId,
      dto.note
    );

    return {
      status: "success",
      message: result.stateReused
        ? "Platform alert was already acknowledged."
        : "Platform alert acknowledged successfully.",
      data: result
    };
  }

  @Post("alerts/:alertId/suppress")
  async suppressPlatformAlert(
    @Param("alertId") alertId: string,
    @Body(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: SuppressPlatformAlertDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.operationsMonitoringService.suppressPlatformAlert(
      alertId,
      request.internalOperator.operatorId,
      dto.suppressedUntil,
      dto.note
    );

    return {
      status: "success",
      message: result.stateReused
        ? "Platform alert suppression already matched the requested state."
        : "Platform alert suppressed successfully.",
      data: result
    };
  }

  @Post("alerts/:alertId/clear-suppression")
  async clearPlatformAlertSuppression(
    @Param("alertId") alertId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: ClearPlatformAlertSuppressionDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result =
      await this.operationsMonitoringService.clearPlatformAlertSuppression(
        alertId,
        request.internalOperator.operatorId,
        dto.note
      );

    return {
      status: "success",
      message: result.stateReused
        ? "Platform alert did not have active suppression."
        : "Platform alert suppression cleared successfully.",
      data: result
    };
  }

  @Post("alerts/:alertId/retry-deliveries")
  async retryPlatformAlertDeliveries(
    @Param("alertId") alertId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: RetryPlatformAlertDeliveriesDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.operationsMonitoringService.retryFailedPlatformAlertDeliveries(
      alertId,
      request.internalOperator.operatorId,
      dto.note
    );

    return {
      status: "success",
      message:
        result.retriedDeliveryCount > 0
          ? "Failed platform alert deliveries queued for retry."
          : "No failed platform alert deliveries required retry.",
      data: result
    };
  }

  @Post("alerts/:alertId/route-review-case")
  async routePlatformAlertToReviewCase(
    @Param("alertId") alertId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: RoutePlatformAlertToReviewCaseDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.operationsMonitoringService.routePlatformAlertToReviewCase(
      alertId,
      request.internalOperator.operatorId,
      dto
    );

    return {
      status: "success",
      message: result.routingStateReused
        ? "Platform alert routing state reused successfully."
        : result.reviewCaseReused
          ? "Platform alert routed to an existing review case successfully."
          : "Platform alert routed to a review case successfully.",
      data: result
    };
  }

  @Get("workers/health")
  async listWorkerRuntimeHealth(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: ListWorkerRuntimeHealthDto
  ): Promise<CustomJsonResponse> {
    const result =
      await this.operationsMonitoringService.listWorkerRuntimeHealth(query);

    return {
      status: "success",
      message: "Worker runtime health retrieved successfully.",
      data: result
    };
  }

  @Get("metrics")
  @Header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
  async getPrometheusMetrics(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: GetOperationsMetricsDto
  ): Promise<string> {
    return this.operationsMonitoringService.renderPrometheusMetrics(
      query,
      this.apiRequestMetricsService
    );
  }
}
