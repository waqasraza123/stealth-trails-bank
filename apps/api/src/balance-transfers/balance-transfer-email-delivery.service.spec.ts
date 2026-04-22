import axios from "axios";
import {
  PlatformAlertCategory,
  PlatformAlertSeverity,
  PlatformAlertStatus,
} from "@prisma/client";
import { loadCustomerTransferEmailDeliveryRuntimeConfig } from "@stealth-trails-bank/config/api";
import { PlatformAlertDeliveryService } from "../operations-monitoring/platform-alert-delivery.service";
import { PrismaService } from "../prisma/prisma.service";
import { BalanceTransferEmailDeliveryService } from "./balance-transfer-email-delivery.service";

jest.mock("axios");
jest.mock("@stealth-trails-bank/config/api", () => ({
  loadCustomerTransferEmailDeliveryRuntimeConfig: jest.fn(() => ({
    mode: "preview",
    webhookUrl: null,
    bearerToken: null,
    requestTimeoutMs: 5000,
    fromEmail: "transfers@example.com",
    fromName: "Transfers",
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
    service: new BalanceTransferEmailDeliveryService(
      prismaService,
      platformAlertDeliveryService
    ),
  };
}

describe("BalanceTransferEmailDeliveryService", () => {
  const baseInput = {
    customerId: "customer_1",
    actorId: "supabase_1",
    email: "ada@example.com",
    role: "sender" as const,
    purpose: "settled" as const,
    transferId: "intent_1",
    assetSymbol: "USDC",
    amount: "125.50",
    counterpartyMaskedDisplay: "B*** R***",
    counterpartyMaskedEmail: "b***t@e****.com",
    createdAt: "2026-04-22T12:00:00.000Z",
    note: "Settled successfully.",
  };

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("records a preview-mode success without calling the webhook", async () => {
    (
      loadCustomerTransferEmailDeliveryRuntimeConfig as jest.Mock
    ).mockReturnValue({
      mode: "preview",
      webhookUrl: null,
      bearerToken: null,
      requestTimeoutMs: 5000,
      fromEmail: "transfers@example.com",
      fromName: "Transfers",
    });
    const { service, prismaService } = createService();
    (prismaService.platformAlert.findUnique as jest.Mock).mockResolvedValue(null);
    (prismaService.auditEvent.create as jest.Mock).mockResolvedValue({
      id: "audit_1",
    });

    await expect(service.sendTransferEmail(baseInput)).resolves.toBeUndefined();

    expect(axios.post).not.toHaveBeenCalled();
    expect(prismaService.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "transaction_intent.internal_balance_transfer.email_delivery_succeeded",
        }),
      })
    );
  });

  it("delivers through the configured webhook and resolves any open delivery alert", async () => {
    (
      loadCustomerTransferEmailDeliveryRuntimeConfig as jest.Mock
    ).mockReturnValue({
      mode: "webhook",
      webhookUrl: "https://mailer.example.com/transfers",
      bearerToken: "secret-token",
      requestTimeoutMs: 5000,
      fromEmail: "transfers@example.com",
      fromName: "Transfers",
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
    (prismaService.platformAlert.findUnique as jest.Mock).mockResolvedValue({
      id: "alert_1",
      status: PlatformAlertStatus.open,
    });
    (prismaService.platformAlert.update as jest.Mock).mockResolvedValue({
      id: "alert_1",
    });

    await expect(service.sendTransferEmail(baseInput)).resolves.toBeUndefined();

    expect(axios.post).toHaveBeenCalledWith(
      "https://mailer.example.com/transfers",
      expect.objectContaining({
        type: "customer_balance_transfer_email",
        recipient: {
          email: "ada@example.com",
        },
      }),
      expect.objectContaining({
        timeout: 5000,
        headers: {
          Authorization: "Bearer secret-token",
        },
      })
    );
    expect(prismaService.platformAlert.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: PlatformAlertStatus.resolved,
        }),
      })
    );
  });

  it("writes failure audit state and opens an alert when webhook delivery fails", async () => {
    (
      loadCustomerTransferEmailDeliveryRuntimeConfig as jest.Mock
    ).mockReturnValue({
      mode: "webhook",
      webhookUrl: "https://mailer.example.com/transfers",
      bearerToken: "secret-token",
      requestTimeoutMs: 5000,
      fromEmail: "transfers@example.com",
      fromName: "Transfers",
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
      dedupeKey: "balance_transfer_email_delivery_failed:webhook:settled",
      category: PlatformAlertCategory.operations,
      severity: PlatformAlertSeverity.critical,
      status: PlatformAlertStatus.open,
      summary: "Balance transfer email delivery failed.",
      detail: "SMTP provider down",
      routingStatus: "unrouted",
      ownerOperatorId: null,
      acknowledgedAt: null,
      suppressedUntil: null,
      metadata: null,
    });

    await expect(service.sendTransferEmail(baseInput)).resolves.toBeUndefined();

    expect(prismaService.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "transaction_intent.internal_balance_transfer.email_delivery_failed",
        }),
      })
    );
    expect(prismaService.platformAlert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: "balance_transfer_email_delivery_failed",
        }),
      })
    );
    expect(platformAlertDeliveryService.enqueueAlertEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "opened",
      })
    );
  });
});
