import { createHash } from "crypto";
import { Injectable } from "@nestjs/common";
import {
  PlatformAlertCategory,
  PlatformAlertDeliveryEventType,
  PlatformAlertRoutingStatus,
  PlatformAlertSeverity,
  PlatformAlertStatus,
  Prisma
} from "@prisma/client";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { PlatformAlertDeliveryService } from "../operations-monitoring/platform-alert-delivery.service";
import type { PrismaJsonValue } from "../prisma/prisma-json";
import { RecordClientTelemetryDto } from "./dto/record-client-telemetry.dto";

type ClientTelemetryRequestContext = {
  readonly requestId: string | null;
  readonly origin: string | null;
  readonly referer: string | null;
  readonly userAgent: string | null;
  readonly remoteAddress: string | null;
};

type RecordClientTelemetryResult = {
  auditEventId: string;
  platformAlertId: string | null;
};

type PlatformAlertRecord = Prisma.PlatformAlertGetPayload<{}>;

const alertEligibleKinds = new Set<
  RecordClientTelemetryDto["kind"]
>([
  "exception",
  "bootstrap_error",
  "unhandled_rejection",
  "query_error",
  "mutation_error"
]);

function isJsonObject(
  value: Prisma.JsonValue | Prisma.InputJsonValue | null | undefined
): value is Prisma.JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

@Injectable()
export class ClientObservabilityService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly platformAlertDeliveryService: PlatformAlertDeliveryService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private trimToNull(value: string | null | undefined): string | null {
    if (typeof value !== "string") {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private sanitizeString(value: string, maxLength: number): string {
    return value.trim().slice(0, maxLength);
  }

  private sanitizeJson(
    value: unknown,
    depth = 0
  ): Prisma.InputJsonValue {
    if (
      value === undefined ||
      typeof value === "boolean" ||
      typeof value === "number"
    ) {
      return value ?? "[undefined]";
    }

    if (value === null) {
      return "null";
    }

    if (typeof value === "string") {
      return value.slice(0, 2000);
    }

    if (depth >= 3) {
      return "[truncated]";
    }

    if (Array.isArray(value)) {
      return value.slice(0, 20).map((entry) => this.sanitizeJson(entry, depth + 1));
    }

    if (typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value)
          .slice(0, 20)
          .map(([key, entry]) => [
            key.slice(0, 80),
            this.sanitizeJson(entry, depth + 1)
          ])
      );
    }

    return String(value).slice(0, 2000);
  }

  private shouldCreatePlatformAlert(
    payload: RecordClientTelemetryDto
  ): boolean {
    return payload.level === "error" && alertEligibleKinds.has(payload.kind);
  }

  private mapAlertSeverity(
    payload: RecordClientTelemetryDto
  ): PlatformAlertSeverity {
    switch (payload.kind) {
      case "bootstrap_error":
      case "exception":
      case "unhandled_rejection":
        return PlatformAlertSeverity.critical;
      default:
        return PlatformAlertSeverity.warning;
    }
  }

  private buildAction(payload: RecordClientTelemetryDto): string {
    return `client_telemetry.${payload.kind}`;
  }

  private buildAlertCode(payload: RecordClientTelemetryDto): string {
    return `client_${payload.kind}`;
  }

  private buildAlertSummary(payload: RecordClientTelemetryDto): string {
    const appLabel = payload.app
      .split(/[-_]/)
      .filter(Boolean)
      .map((segment) => segment[0]?.toUpperCase() + segment.slice(1))
      .join(" ");
    const kindLabel = payload.kind.replace(/_/g, " ");

    return `${appLabel} ${kindLabel}`;
  }

  private buildAlertDedupeKey(payload: RecordClientTelemetryDto): string {
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify({
          app: payload.app,
          environment: payload.environment,
          kind: payload.kind,
          errorName: payload.errorName ?? null,
          message: payload.message
        })
      )
      .digest("hex")
      .slice(0, 20);

    return `client:${payload.app}:${payload.kind}:${fingerprint}`;
  }

  private readOccurrenceCount(metadata: Prisma.JsonValue | null): number {
    if (!isJsonObject(metadata)) {
      return 0;
    }

    const rawCount = metadata["occurrenceCount"];
    return typeof rawCount === "number" && Number.isFinite(rawCount)
      ? rawCount
      : 0;
  }

  private buildAuditMetadata(
    payload: RecordClientTelemetryDto,
    requestContext: ClientTelemetryRequestContext
  ): PrismaJsonValue {
    return {
      environment: this.sanitizeString(payload.environment, 64),
      release: this.trimToNull(payload.release),
      sessionId: this.sanitizeString(payload.sessionId, 64),
      eventTimestamp: payload.timestamp,
      level: payload.level,
      errorName: this.trimToNull(payload.errorName),
      stack: this.trimToNull(payload.stack)?.slice(0, 12000) ?? null,
      tags: payload.tags ? this.sanitizeJson(payload.tags) : null,
      context: payload.context ? this.sanitizeJson(payload.context) : null,
      request: {
        requestId: requestContext.requestId,
        origin: requestContext.origin,
        referer: requestContext.referer,
        userAgent: requestContext.userAgent,
        remoteAddress: requestContext.remoteAddress
      }
    } as PrismaJsonValue;
  }

  private buildAlertMetadata(args: {
    payload: RecordClientTelemetryDto;
    requestContext: ClientTelemetryRequestContext;
    occurrenceCount: number;
    detectedAt: Date;
  }): PrismaJsonValue {
    return {
      source: "client_observability",
      app: args.payload.app,
      environment: args.payload.environment,
      release: this.trimToNull(args.payload.release),
      kind: args.payload.kind,
      level: args.payload.level,
      sessionId: args.payload.sessionId,
      eventTimestamp: args.payload.timestamp,
      detectedAt: args.detectedAt.toISOString(),
      errorName: this.trimToNull(args.payload.errorName),
      stack: this.trimToNull(args.payload.stack)?.slice(0, 12000) ?? null,
      occurrenceCount: args.occurrenceCount,
      tags: args.payload.tags ? this.sanitizeJson(args.payload.tags) : null,
      context: args.payload.context ? this.sanitizeJson(args.payload.context) : null,
      request: {
        requestId: args.requestContext.requestId,
        origin: args.requestContext.origin,
        referer: args.requestContext.referer,
        userAgent: args.requestContext.userAgent,
        remoteAddress: args.requestContext.remoteAddress
      }
    } as PrismaJsonValue;
  }

  private buildDeliveryPayload(alert: PlatformAlertRecord) {
    return {
      id: alert.id,
      dedupeKey: alert.dedupeKey,
      category: alert.category,
      severity: alert.severity,
      status: alert.status,
      summary: alert.summary,
      detail: alert.detail,
      routingStatus: alert.routingStatus,
      ownerOperatorId: alert.ownerOperatorId,
      acknowledgedAt: alert.acknowledgedAt?.toISOString() ?? null,
      suppressedUntil: alert.suppressedUntil?.toISOString() ?? null,
      metadata: alert.metadata
    };
  }

  private async upsertPlatformAlert(
    payload: RecordClientTelemetryDto,
    requestContext: ClientTelemetryRequestContext
  ): Promise<string | null> {
    if (!this.shouldCreatePlatformAlert(payload)) {
      return null;
    }

    const dedupeKey = this.buildAlertDedupeKey(payload);
    const detectedAt = new Date();
    const existingAlert = await this.prismaService.platformAlert.findUnique({
      where: {
        dedupeKey
      }
    });
    const severity = this.mapAlertSeverity(payload);

    if (!existingAlert) {
      const createdAlert = await this.prismaService.platformAlert.create({
        data: {
          dedupeKey,
          category: PlatformAlertCategory.operations,
          severity,
          status: PlatformAlertStatus.open,
          routingStatus: PlatformAlertRoutingStatus.unrouted,
          code: this.buildAlertCode(payload),
          summary: this.buildAlertSummary(payload),
          detail: this.sanitizeString(payload.message, 1000),
          metadata: this.buildAlertMetadata({
            payload,
            requestContext,
            occurrenceCount: 1,
            detectedAt
          }),
          firstDetectedAt: detectedAt,
          lastDetectedAt: detectedAt
        }
      });
      await this.notificationsService.publishPlatformAlertRecord(createdAlert);

      void this.platformAlertDeliveryService.enqueueAlertEvent({
        alert: this.buildDeliveryPayload(createdAlert),
        eventType: PlatformAlertDeliveryEventType.opened,
        metadata: {
          source: "client_observability",
          app: payload.app,
          kind: payload.kind
        }
      });

      return createdAlert.id;
    }

    const reopened = existingAlert.status === PlatformAlertStatus.resolved;
    const updatedAlert = await this.prismaService.platformAlert.update({
      where: {
        id: existingAlert.id
      },
      data: {
        severity:
          existingAlert.severity === PlatformAlertSeverity.critical
            ? PlatformAlertSeverity.critical
            : severity,
        status: PlatformAlertStatus.open,
        ...(reopened
          ? {
              resolvedAt: null,
              routingStatus: PlatformAlertRoutingStatus.unrouted,
              routingTargetType: null,
              routingTargetId: null,
              routedAt: null,
              routedByOperatorId: null,
              routingNote: null,
              acknowledgedAt: null,
              acknowledgedByOperatorId: null,
              acknowledgementNote: null,
              suppressedUntil: null,
              suppressedByOperatorId: null,
              suppressionNote: null
            }
          : {}),
        code: this.buildAlertCode(payload),
        summary: this.buildAlertSummary(payload),
        detail: this.sanitizeString(payload.message, 1000),
        metadata: this.buildAlertMetadata({
          payload,
          requestContext,
          occurrenceCount: this.readOccurrenceCount(existingAlert.metadata) + 1,
          detectedAt
        }),
        lastDetectedAt: detectedAt
      }
    });
    await this.notificationsService.publishPlatformAlertRecord(updatedAlert);

    if (reopened) {
      void this.platformAlertDeliveryService.enqueueAlertEvent({
        alert: this.buildDeliveryPayload(updatedAlert),
        eventType: PlatformAlertDeliveryEventType.opened,
        metadata: {
          source: "client_observability",
          app: payload.app,
          kind: payload.kind,
          reopened: true
        }
      });
    }

    return updatedAlert.id;
  }

  async recordTelemetry(
    payload: RecordClientTelemetryDto,
    requestContext: ClientTelemetryRequestContext
  ): Promise<RecordClientTelemetryResult> {
    const auditEvent = await this.prismaService.auditEvent.create({
      data: {
        actorType: "client_app",
        actorId: this.sanitizeString(payload.app, 64),
        action: this.buildAction(payload),
        targetType: "ClientRuntime",
        targetId: this.sanitizeString(
          `${payload.app}:${payload.sessionId}`,
          191
        ),
        metadata: this.buildAuditMetadata(payload, requestContext)
      }
    });

    const platformAlertId = await this.upsertPlatformAlert(
      payload,
      requestContext
    );

    return {
      auditEventId: auditEvent.id,
      platformAlertId
    };
  }
}
