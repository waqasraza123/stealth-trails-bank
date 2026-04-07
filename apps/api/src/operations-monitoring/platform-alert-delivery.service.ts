import axios from "axios";
import {
  loadPlatformAlertDeliveryRuntimeConfig,
  type PlatformAlertDeliveryRuntimeConfig,
  type PlatformAlertDeliveryTargetRuntimeConfig
} from "@stealth-trails-bank/config/api";
import {
  PlatformAlertCategory,
  PlatformAlertDeliveryEventType,
  PlatformAlertDeliveryStatus,
  PlatformAlertSeverity,
  PlatformAlertStatus,
  Prisma
} from "@prisma/client";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

type PlatformAlertDeliveryPayload = {
  id: string;
  dedupeKey: string;
  category: PlatformAlertCategory;
  severity: PlatformAlertSeverity;
  status: PlatformAlertStatus;
  summary: string;
  detail: string | null;
  routingStatus: string;
  ownerOperatorId: string | null;
  acknowledgedAt: string | null;
  suppressedUntil: string | null;
  metadata: Prisma.JsonValue | null;
};

type PlatformAlertDeliveryMetadata = Record<string, unknown>;

type PlatformAlertDeliveryContext = {
  targetName: string;
  escalatedFromDeliveryId: string | null;
  escalatedFromTargetName: string | null;
  escalationLevel: number;
  escalationReason: string | null;
};

function isJsonObject(
  value: unknown
): value is Prisma.JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

@Injectable()
export class PlatformAlertDeliveryService {
  private readonly runtimeConfig: PlatformAlertDeliveryRuntimeConfig;

  constructor(private readonly prismaService: PrismaService) {
    this.runtimeConfig = loadPlatformAlertDeliveryRuntimeConfig();
  }

  private severityRank(severity: PlatformAlertSeverity): number {
    return severity === PlatformAlertSeverity.critical ? 2 : 1;
  }

  private shouldDeliverToTarget(
    target: PlatformAlertDeliveryTargetRuntimeConfig,
    alert: PlatformAlertDeliveryPayload,
    eventType: PlatformAlertDeliveryEventType
  ): boolean {
    return (
      target.categories.includes(alert.category) &&
      this.severityRank(alert.severity) >= this.severityRank(target.minimumSeverity) &&
      target.eventTypes.includes(eventType)
    );
  }

  private getTargetByName(
    targetName: string
  ): PlatformAlertDeliveryTargetRuntimeConfig | null {
    return (
      this.runtimeConfig.targets.find((target) => target.name === targetName) ?? null
    );
  }

  private readAlertPayload(
    requestPayload: Prisma.JsonValue
  ): PlatformAlertDeliveryPayload | null {
    if (!isJsonObject(requestPayload)) {
      return null;
    }

    const rawAlert = requestPayload["alert"];

    if (!isJsonObject(rawAlert)) {
      return null;
    }

    if (
      typeof rawAlert["id"] !== "string" ||
      typeof rawAlert["dedupeKey"] !== "string" ||
      typeof rawAlert["category"] !== "string" ||
      typeof rawAlert["severity"] !== "string" ||
      typeof rawAlert["status"] !== "string" ||
      typeof rawAlert["summary"] !== "string" ||
      typeof rawAlert["routingStatus"] !== "string"
    ) {
      return null;
    }

    return {
      id: rawAlert["id"],
      dedupeKey: rawAlert["dedupeKey"],
      category: rawAlert["category"] as PlatformAlertCategory,
      severity: rawAlert["severity"] as PlatformAlertSeverity,
      status: rawAlert["status"] as PlatformAlertStatus,
      summary: rawAlert["summary"],
      detail: typeof rawAlert["detail"] === "string" ? rawAlert["detail"] : null,
      routingStatus: rawAlert["routingStatus"],
      ownerOperatorId:
        typeof rawAlert["ownerOperatorId"] === "string"
          ? rawAlert["ownerOperatorId"]
          : null,
      acknowledgedAt:
        typeof rawAlert["acknowledgedAt"] === "string"
          ? rawAlert["acknowledgedAt"]
          : null,
      suppressedUntil:
        typeof rawAlert["suppressedUntil"] === "string"
          ? rawAlert["suppressedUntil"]
          : null,
      metadata: rawAlert["metadata"] ?? null
    };
  }

  private readRequestMetadata(
    requestPayload: Prisma.JsonValue
  ): PlatformAlertDeliveryMetadata | undefined {
    if (!isJsonObject(requestPayload)) {
      return undefined;
    }

    const rawMetadata = requestPayload["metadata"];

    return isJsonObject(rawMetadata)
      ? (rawMetadata as PlatformAlertDeliveryMetadata)
      : undefined;
  }

  private buildRequestPayload(
    alert: PlatformAlertDeliveryPayload,
    eventType: PlatformAlertDeliveryEventType,
    context: PlatformAlertDeliveryContext,
    metadata?: PlatformAlertDeliveryMetadata
  ): Prisma.InputJsonValue {
    return {
      eventType,
      generatedAt: new Date().toISOString(),
      alert,
      delivery: {
        targetName: context.targetName,
        escalatedFromDeliveryId: context.escalatedFromDeliveryId,
        escalatedFromTargetName: context.escalatedFromTargetName,
        escalationLevel: context.escalationLevel,
        escalationReason: context.escalationReason
      },
      ...(metadata ? { metadata } : {})
    } as Prisma.InputJsonValue;
  }

  private async createPendingDelivery(args: {
    alert: PlatformAlertDeliveryPayload;
    eventType: PlatformAlertDeliveryEventType;
    target: PlatformAlertDeliveryTargetRuntimeConfig;
    metadata?: PlatformAlertDeliveryMetadata;
    escalatedFromDeliveryId?: string | null;
    escalatedFromTargetName?: string | null;
    escalationLevel?: number;
    escalationReason?: string | null;
  }): Promise<string> {
    const escalationLevel = args.escalationLevel ?? 0;
    const createdDelivery = await this.prismaService.platformAlertDelivery.create({
      data: {
        platformAlertId: args.alert.id,
        targetName: args.target.name,
        targetUrl: args.target.url,
        eventType: args.eventType,
        escalatedFromDeliveryId: args.escalatedFromDeliveryId ?? null,
        escalationLevel,
        escalationReason: args.escalationReason ?? null,
        status: PlatformAlertDeliveryStatus.pending,
        attemptCount: 0,
        requestPayload: this.buildRequestPayload(
          args.alert,
          args.eventType,
          {
            targetName: args.target.name,
            escalatedFromDeliveryId: args.escalatedFromDeliveryId ?? null,
            escalatedFromTargetName: args.escalatedFromTargetName ?? null,
            escalationLevel,
            escalationReason: args.escalationReason ?? null
          },
          args.metadata
        )
      }
    });

    return createdDelivery.id;
  }

  async enqueueAlertEvent(args: {
    alert: PlatformAlertDeliveryPayload;
    eventType: PlatformAlertDeliveryEventType;
    metadata?: PlatformAlertDeliveryMetadata;
  }): Promise<number> {
    const targets = this.runtimeConfig.targets.filter(
      (target) =>
        target.deliveryMode === "direct" &&
        this.shouldDeliverToTarget(target, args.alert, args.eventType)
    );

    if (targets.length === 0) {
      return 0;
    }

    const deliveryIds: string[] = [];

    for (const target of targets) {
      deliveryIds.push(
        await this.createPendingDelivery({
          alert: args.alert,
          eventType: args.eventType,
          target,
          metadata: args.metadata
        })
      );
    }

    void this.processPendingDeliveries(deliveryIds);

    return deliveryIds.length;
  }

  async retryFailedDeliveriesForAlert(alertId: string): Promise<number> {
    const failedDeliveries = await this.prismaService.platformAlertDelivery.findMany({
      where: {
        platformAlertId: alertId,
        status: PlatformAlertDeliveryStatus.failed
      },
      select: {
        id: true
      }
    });

    if (failedDeliveries.length === 0) {
      return 0;
    }

    const deliveryIds = failedDeliveries.map((delivery) => delivery.id);

    await this.prismaService.platformAlertDelivery.updateMany({
      where: {
        id: {
          in: deliveryIds
        }
      },
      data: {
        status: PlatformAlertDeliveryStatus.pending,
        responseStatusCode: null,
        errorMessage: null
      }
    });

    void this.processPendingDeliveries(deliveryIds);

    return deliveryIds.length;
  }

  private async processPendingDeliveries(deliveryIds: string[]): Promise<void> {
    const deliveries = await this.prismaService.platformAlertDelivery.findMany({
      where: {
        id: {
          in: deliveryIds
        },
        status: PlatformAlertDeliveryStatus.pending
      }
    });

    for (const delivery of deliveries) {
      await this.processSingleDelivery(delivery.id);
    }
  }

  private async enqueueFailoverDeliveries(deliveryId: string): Promise<number> {
    const delivery = await this.prismaService.platformAlertDelivery.findUnique({
      where: {
        id: deliveryId
      }
    });

    if (!delivery) {
      return 0;
    }

    const sourceTarget = this.getTargetByName(delivery.targetName);

    if (!sourceTarget || sourceTarget.failoverTargetNames.length === 0) {
      return 0;
    }

    const alert = this.readAlertPayload(delivery.requestPayload);

    if (!alert) {
      return 0;
    }

    const metadata = this.readRequestMetadata(delivery.requestPayload);
    const existingEscalations = await this.prismaService.platformAlertDelivery.findMany({
      where: {
        escalatedFromDeliveryId: delivery.id
      },
      select: {
        targetName: true
      }
    });
    const existingEscalationTargetNames = new Set(
      existingEscalations.map((record) => record.targetName)
    );
    const deliveryIds: string[] = [];

    for (const failoverTargetName of sourceTarget.failoverTargetNames) {
      if (existingEscalationTargetNames.has(failoverTargetName)) {
        continue;
      }

      const failoverTarget = this.getTargetByName(failoverTargetName);

      if (
        !failoverTarget ||
        !this.shouldDeliverToTarget(failoverTarget, alert, delivery.eventType)
      ) {
        continue;
      }

      deliveryIds.push(
        await this.createPendingDelivery({
          alert,
          eventType: delivery.eventType,
          target: failoverTarget,
          metadata,
          escalatedFromDeliveryId: delivery.id,
          escalatedFromTargetName: delivery.targetName,
          escalationLevel: delivery.escalationLevel + 1,
          escalationReason: "delivery_failed"
        })
      );
    }

    if (deliveryIds.length > 0) {
      void this.processPendingDeliveries(deliveryIds);
    }

    return deliveryIds.length;
  }

  private async processSingleDelivery(deliveryId: string): Promise<void> {
    const delivery = await this.prismaService.platformAlertDelivery.findUnique({
      where: {
        id: deliveryId
      }
    });

    if (!delivery || delivery.status !== PlatformAlertDeliveryStatus.pending) {
      return;
    }

    const attemptedAt = new Date();

    try {
      const target = this.getTargetByName(delivery.targetName);
      const response = await axios.post(delivery.targetUrl, delivery.requestPayload, {
        timeout: this.runtimeConfig.requestTimeoutMs,
        headers: {
          "Content-Type": "application/json",
          "X-Stealth-Trails-Alert-Event": delivery.eventType,
          "X-Stealth-Trails-Alert-Target": delivery.targetName,
          ...(delivery.escalationLevel > 0
            ? {
                "X-Stealth-Trails-Alert-Escalation-Level": String(
                  delivery.escalationLevel
                )
              }
            : {}),
          ...(target?.bearerToken
            ? {
                Authorization: `Bearer ${target.bearerToken}`
              }
            : {})
        }
      });

      await this.prismaService.platformAlertDelivery.update({
        where: {
          id: delivery.id
        },
        data: {
          status: PlatformAlertDeliveryStatus.succeeded,
          attemptCount: delivery.attemptCount + 1,
          responseStatusCode: response.status,
          errorMessage: null,
          lastAttemptedAt: attemptedAt,
          deliveredAt: attemptedAt
        }
      });
    } catch (error) {
      const axiosError = axios.isAxiosError(error) ? error : null;
      const errorMessage =
        axiosError?.response?.data && typeof axiosError.response.data === "string"
          ? axiosError.response.data
          : axiosError?.message ?? "Unknown delivery error.";

      await this.prismaService.platformAlertDelivery.update({
        where: {
          id: delivery.id
        },
        data: {
          status: PlatformAlertDeliveryStatus.failed,
          attemptCount: delivery.attemptCount + 1,
          responseStatusCode: axiosError?.response?.status ?? null,
          errorMessage,
          lastAttemptedAt: attemptedAt
        }
      });

      await this.enqueueFailoverDeliveries(delivery.id);
    }
  }
}
