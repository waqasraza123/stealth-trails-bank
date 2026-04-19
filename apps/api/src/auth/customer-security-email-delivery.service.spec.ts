import axios from "axios";
import {
  PlatformAlertCategory,
  PlatformAlertSeverity,
  PlatformAlertStatus,
} from "@prisma/client";
import { loadCustomerSecurityEmailDeliveryRuntimeConfig } from "@stealth-trails-bank/config/api";
import { ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PlatformAlertDeliveryService } from "../operations-monitoring/platform-alert-delivery.service";
import { CustomerSecurityEmailDeliveryService } from "./customer-security-email-delivery.service";

jest.mock("axios");
jest.mock("@stealth-trails-bank/config/api", () => ({
  loadCustomerSecurityEmailDeliveryRuntimeConfig: jest.fn(() => ({
    mode: "preview",
    webhookUrl: null,
    bearerToken: null,
    requestTimeoutMs: 5000,
    fromEmail: "security@example.com",
    fromName: "Security",
  })),
}));

function createService() {
  const prismaService = {
    auditEvent: {
      create: jest.fn(),
    },
    platformAlert: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  } as unknown as PrismaService;

  const platformAlertDeliveryService = {
    enqueueAlertEvent: jest.fn().mockResolvedValue(0),
  } as unknown as PlatformAlertDeliveryService;

  return {
    prismaService,
    platformAlertDeliveryService,
    service: new CustomerSecurityEmailDeliveryService(
      prismaService,
      platformAlertDeliveryService,
    ),
  };
}

describe("CustomerSecurityEmailDeliveryService", () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("records success in preview mode without calling a webhook", async () => {
    (loadCustomerSecurityEmailDeliveryRuntimeConfig as jest.Mock).mockReturnValue({
      mode: "preview",
      webhookUrl: null,
      bearerToken: null,
      requestTimeoutMs: 5000,
      fromEmail: "security@example.com",
      fromName: "Security",
    });
    const { service, prismaService } = createService();
    (prismaService.platformAlert.findUnique as jest.Mock).mockResolvedValue(null);
    (prismaService.auditEvent.create as jest.Mock).mockResolvedValue({
      id: "audit_1",
    });

    await service.sendSessionAlert({
      customerId: "customer_1",
      actorId: "supabase_1",
      email: "ada@example.com",
      purpose: "new_session_login",
      clientPlatform: "web",
      userAgent: "Mozilla/5.0",
      ipAddress: "203.0.113.10",
      occurredAt: "2026-04-19T20:00:00.000Z",
    });

    expect(prismaService.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "customer_account.security_email_delivery_succeeded",
        }),
      }),
    );
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("delivers through the configured webhook", async () => {
    (loadCustomerSecurityEmailDeliveryRuntimeConfig as jest.Mock).mockReturnValue({
      mode: "webhook",
      webhookUrl: "https://mailer.example.com/security",
      bearerToken: "secret-token",
      requestTimeoutMs: 5000,
      fromEmail: "security@example.com",
      fromName: "Security",
    });
    const { service, prismaService } = createService();
    (axios.post as jest.Mock).mockResolvedValue({
      status: 202,
      data: {
        deliveryId: "delivery_1",
      },
    });
    (prismaService.auditEvent.create as jest.Mock).mockResolvedValue({
      id: "audit_1",
    });
    (prismaService.platformAlert.findUnique as jest.Mock).mockResolvedValue(null);

    await service.sendSessionAlert({
      customerId: "customer_1",
      actorId: "supabase_1",
      email: "ada@example.com",
      purpose: "new_session_login",
      clientPlatform: "mobile",
      userAgent: null,
      ipAddress: "198.51.100.24",
      occurredAt: "2026-04-19T20:00:00.000Z",
    });

    expect(axios.post).toHaveBeenCalledWith(
      "https://mailer.example.com/security",
      expect.objectContaining({
        type: "customer_security_email",
        recipient: {
          email: "ada@example.com",
        },
      }),
      expect.objectContaining({
        timeout: 5000,
        headers: {
          Authorization: "Bearer secret-token",
        },
      }),
    );
  });

  it("raises a platform alert and throws when webhook delivery fails", async () => {
    (loadCustomerSecurityEmailDeliveryRuntimeConfig as jest.Mock).mockReturnValue({
      mode: "webhook",
      webhookUrl: "https://mailer.example.com/security",
      bearerToken: "secret-token",
      requestTimeoutMs: 5000,
      fromEmail: "security@example.com",
      fromName: "Security",
    });
    const { service, prismaService, platformAlertDeliveryService } =
      createService();
    (axios.post as jest.Mock).mockRejectedValue(new Error("SMTP provider down"));
    (prismaService.auditEvent.create as jest.Mock).mockResolvedValue({
      id: "audit_1",
    });
    (prismaService.platformAlert.findUnique as jest.Mock).mockResolvedValue(null);
    (prismaService.platformAlert.create as jest.Mock).mockResolvedValue({
      id: "alert_1",
      dedupeKey: "customer_security_email_delivery_failed:webhook:new_session_login",
      category: PlatformAlertCategory.operations,
      severity: PlatformAlertSeverity.critical,
      status: PlatformAlertStatus.open,
      summary: "Customer security email delivery failed.",
      detail: "SMTP provider down",
      routingStatus: "unrouted",
      ownerOperatorId: null,
      acknowledgedAt: null,
      suppressedUntil: null,
      metadata: null,
    });

    await expect(
      service.sendSessionAlert({
        customerId: "customer_1",
        actorId: "supabase_1",
        email: "ada@example.com",
        purpose: "new_session_login",
        clientPlatform: "web",
        userAgent: "Mozilla/5.0",
        ipAddress: "203.0.113.10",
        occurredAt: "2026-04-19T20:00:00.000Z",
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(prismaService.platformAlert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: "customer_security_email_delivery_failed",
        }),
      }),
    );
    expect(platformAlertDeliveryService.enqueueAlertEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "opened",
      }),
    );
  });
});
