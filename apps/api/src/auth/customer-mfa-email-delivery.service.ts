import axios from "axios";
import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import {
  PlatformAlertCategory,
  PlatformAlertDeliveryEventType,
  PlatformAlertRoutingStatus,
  PlatformAlertSeverity,
  PlatformAlertStatus,
  Prisma,
} from "@prisma/client";
import {
  loadCustomerMfaEmailDeliveryRuntimeConfig,
  type CustomerMfaEmailDeliveryRuntimeConfig,
} from "@stealth-trails-bank/config/api";
import { PlatformAlertDeliveryService } from "../operations-monitoring/platform-alert-delivery.service";
import { PrismaService } from "../prisma/prisma.service";
import type { PrismaJsonValue } from "../prisma/prisma-json";

type CustomerMfaEmailPurpose =
  | "email_enrollment"
  | "email_recovery"
  | "withdrawal_step_up"
  | "password_step_up";

type SendCustomerMfaEmailInput = {
  customerId: string;
  actorId: string;
  email: string;
  challengeId: string;
  purpose: CustomerMfaEmailPurpose;
  code: string;
  expiresAt: string;
};

type SendCustomerMfaEmailResult = {
  deliveryChannel: "email";
  previewCode: string | null;
  backendType: "preview" | "webhook";
  backendReference: string | null;
};

type PlatformAlertRecord = Prisma.PlatformAlertGetPayload<{}>;

function isJsonObject(value: unknown): value is Prisma.JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

@Injectable()
export class CustomerMfaEmailDeliveryService {
  private readonly runtimeConfig: CustomerMfaEmailDeliveryRuntimeConfig;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly platformAlertDeliveryService: PlatformAlertDeliveryService,
  ) {
    this.runtimeConfig = loadCustomerMfaEmailDeliveryRuntimeConfig();
  }

  private trimToNull(value: string | null | undefined): string | null {
    if (typeof value !== "string") {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private sanitizeText(
    value: string | null | undefined,
    maxLength: number,
  ): string {
    return (value ?? "").trim().slice(0, maxLength);
  }

  private buildFailureAlertDedupeKey(purpose: CustomerMfaEmailPurpose): string {
    return `customer_mfa_email_delivery_failed:${this.runtimeConfig.mode}:${purpose}`;
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
      metadata: alert.metadata,
    };
  }

  private buildAuditMetadata(input: {
    email: string;
    challengeId: string;
    purpose: CustomerMfaEmailPurpose;
    expiresAt: string;
    backendType: "preview" | "webhook";
    backendReference?: string | null;
    httpStatus?: number | null;
    failureReason?: string | null;
    previewCodeExposed: boolean;
  }): PrismaJsonValue {
    return {
      email: input.email,
      challengeId: input.challengeId,
      purpose: input.purpose,
      expiresAt: input.expiresAt,
      deliveryBackendType: input.backendType,
      deliveryBackendReference: input.backendReference ?? null,
      deliveryHttpStatus: input.httpStatus ?? null,
      deliveryFailureReason: input.failureReason ?? null,
      previewCodeExposed: input.previewCodeExposed,
      fromEmail: this.runtimeConfig.fromEmail,
      fromName: this.runtimeConfig.fromName,
      deliveryMode: this.runtimeConfig.mode,
    } as PrismaJsonValue;
  }

  private async appendAuditEvent(input: {
    customerId: string;
    actorId: string;
    action: string;
    metadata: PrismaJsonValue;
  }): Promise<void> {
    await this.prismaService.auditEvent.create({
      data: {
        customerId: input.customerId,
        actorType: "customer",
        actorId: input.actorId,
        action: input.action,
        targetType: "Customer",
        targetId: input.customerId,
        metadata: input.metadata,
      },
    });
  }

  private async resolveFailureAlert(dedupeKey: string): Promise<void> {
    const existingAlert = await this.prismaService.platformAlert.findUnique({
      where: { dedupeKey },
    });

    if (
      !existingAlert ||
      existingAlert.status === PlatformAlertStatus.resolved
    ) {
      return;
    }

    await this.prismaService.platformAlert.update({
      where: { id: existingAlert.id },
      data: {
        status: PlatformAlertStatus.resolved,
        resolvedAt: new Date(),
      },
    });
  }

  private async upsertFailureAlert(input: {
    purpose: CustomerMfaEmailPurpose;
    failureReason: string;
    email: string;
  }): Promise<void> {
    const dedupeKey = this.buildFailureAlertDedupeKey(input.purpose);
    const detectedAt = new Date();
    const existingAlert = await this.prismaService.platformAlert.findUnique({
      where: { dedupeKey },
    });

    const metadata = {
      source: "customer_mfa_email_delivery",
      purpose: input.purpose,
      deliveryMode: this.runtimeConfig.mode,
      email: input.email,
      webhookUrl: this.runtimeConfig.webhookUrl,
      failureReason: input.failureReason,
      detectedAt: detectedAt.toISOString(),
    } as PrismaJsonValue;

    if (!existingAlert) {
      const createdAlert = await this.prismaService.platformAlert.create({
        data: {
          dedupeKey,
          category: PlatformAlertCategory.operations,
          severity: PlatformAlertSeverity.critical,
          status: PlatformAlertStatus.open,
          routingStatus: PlatformAlertRoutingStatus.unrouted,
          code: "customer_mfa_email_delivery_failed",
          summary: "Customer MFA email delivery failed.",
          detail: this.sanitizeText(input.failureReason, 1000),
          metadata,
          firstDetectedAt: detectedAt,
          lastDetectedAt: detectedAt,
        },
      });

      void this.platformAlertDeliveryService.enqueueAlertEvent({
        alert: this.buildDeliveryPayload(createdAlert),
        eventType: PlatformAlertDeliveryEventType.opened,
        metadata: {
          source: "customer_mfa_email_delivery",
          purpose: input.purpose,
        },
      });

      return;
    }

    const reopened = existingAlert.status === PlatformAlertStatus.resolved;
    const updatedAlert = await this.prismaService.platformAlert.update({
      where: { id: existingAlert.id },
      data: {
        status: PlatformAlertStatus.open,
        resolvedAt: null,
        routingStatus: reopened
          ? PlatformAlertRoutingStatus.unrouted
          : existingAlert.routingStatus,
        detail: this.sanitizeText(input.failureReason, 1000),
        metadata,
        lastDetectedAt: detectedAt,
      },
    });

    if (reopened) {
      void this.platformAlertDeliveryService.enqueueAlertEvent({
        alert: this.buildDeliveryPayload(updatedAlert),
        eventType: PlatformAlertDeliveryEventType.reopened,
        metadata: {
          source: "customer_mfa_email_delivery",
          purpose: input.purpose,
          reopened: true,
        },
      });
    }
  }

  async sendCode(
    input: SendCustomerMfaEmailInput,
  ): Promise<SendCustomerMfaEmailResult> {
    const failureAlertDedupeKey = this.buildFailureAlertDedupeKey(
      input.purpose,
    );

    if (this.runtimeConfig.mode === "preview") {
      await this.appendAuditEvent({
        customerId: input.customerId,
        actorId: input.actorId,
        action: "customer_account.mfa_email_delivery_succeeded",
        metadata: this.buildAuditMetadata({
          email: input.email,
          challengeId: input.challengeId,
          purpose: input.purpose,
          expiresAt: input.expiresAt,
          backendType: "preview",
          previewCodeExposed: process.env.NODE_ENV !== "production",
        }),
      });

      await this.resolveFailureAlert(failureAlertDedupeKey);

      return {
        deliveryChannel: "email",
        previewCode: process.env.NODE_ENV !== "production" ? input.code : null,
        backendType: "preview",
        backendReference: null,
      };
    }

    try {
      const response = await axios.post(
        this.runtimeConfig.webhookUrl!,
        {
          type: "customer_mfa_email_otp",
          from: {
            email: this.runtimeConfig.fromEmail,
            name: this.runtimeConfig.fromName,
          },
          recipient: {
            email: input.email,
          },
          challenge: {
            id: input.challengeId,
            purpose: input.purpose,
            expiresAt: input.expiresAt,
            code: input.code,
          },
        },
        {
          timeout: this.runtimeConfig.requestTimeoutMs,
          headers: {
            ...(this.runtimeConfig.bearerToken
              ? {
                  Authorization: `Bearer ${this.runtimeConfig.bearerToken}`,
                }
              : {}),
          },
        },
      );

      const backendReference =
        response.data &&
        typeof response.data === "object" &&
        !Array.isArray(response.data) &&
        typeof response.data["deliveryId"] === "string"
          ? response.data["deliveryId"]
          : null;

      await this.appendAuditEvent({
        customerId: input.customerId,
        actorId: input.actorId,
        action: "customer_account.mfa_email_delivery_succeeded",
        metadata: this.buildAuditMetadata({
          email: input.email,
          challengeId: input.challengeId,
          purpose: input.purpose,
          expiresAt: input.expiresAt,
          backendType: "webhook",
          backendReference,
          httpStatus: response.status,
          previewCodeExposed: false,
        }),
      });

      await this.resolveFailureAlert(failureAlertDedupeKey);

      return {
        deliveryChannel: "email",
        previewCode: null,
        backendType: "webhook",
        backendReference,
      };
    } catch (error) {
      const responseStatus =
        axios.isAxiosError(error) && error.response?.status
          ? error.response.status
          : null;
      const failureReason =
        this.trimToNull(
          axios.isAxiosError(error)
            ? error.message
            : error instanceof Error
              ? error.message
              : "Unknown email delivery failure.",
        ) ?? "Unknown email delivery failure.";

      await this.appendAuditEvent({
        customerId: input.customerId,
        actorId: input.actorId,
        action: "customer_account.mfa_email_delivery_failed",
        metadata: this.buildAuditMetadata({
          email: input.email,
          challengeId: input.challengeId,
          purpose: input.purpose,
          expiresAt: input.expiresAt,
          backendType: "webhook",
          httpStatus: responseStatus,
          failureReason,
          previewCodeExposed: false,
        }),
      });

      await this.upsertFailureAlert({
        purpose: input.purpose,
        failureReason,
        email: input.email,
      });

      throw new ServiceUnavailableException(
        "Email MFA delivery is temporarily unavailable. Try again shortly.",
      );
    }
  }
}
