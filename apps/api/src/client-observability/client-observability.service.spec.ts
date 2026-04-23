import {
  PlatformAlertCategory,
  PlatformAlertDeliveryEventType,
  PlatformAlertRoutingStatus,
  PlatformAlertSeverity,
  PlatformAlertStatus
} from "@prisma/client";
import { PlatformAlertDeliveryService } from "../operations-monitoring/platform-alert-delivery.service";
import { PrismaService } from "../prisma/prisma.service";
import { ClientObservabilityService } from "./client-observability.service";

function createService() {
  const prismaService = {
    auditEvent: {
      create: jest.fn()
    },
    platformAlert: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    }
  } as unknown as PrismaService;
  const deliveryService = {
    enqueueAlertEvent: jest.fn()
  } as unknown as PlatformAlertDeliveryService;
  const notificationsService = {
    publishPlatformAlertRecord: jest.fn().mockResolvedValue(undefined)
  };

  return {
    prismaService,
    deliveryService,
    notificationsService,
    service: new ClientObservabilityService(
      prismaService,
      deliveryService,
      notificationsService as never
    )
  };
}

describe("ClientObservabilityService", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("records telemetry into audit events and raises a deduped alert for runtime crashes", async () => {
    const { service, prismaService, deliveryService } = createService();

    (prismaService.auditEvent.create as jest.Mock).mockResolvedValue({
      id: "audit_1"
    });
    (prismaService.platformAlert.findUnique as jest.Mock).mockResolvedValue(null);
    (prismaService.platformAlert.create as jest.Mock).mockResolvedValue({
      id: "alert_1",
      dedupeKey: "client:customer-web:exception:abc123",
      category: PlatformAlertCategory.operations,
      severity: PlatformAlertSeverity.critical,
      status: PlatformAlertStatus.open,
      summary: "Customer Web exception",
      detail: "Runtime crashed",
      routingStatus: PlatformAlertRoutingStatus.unrouted,
      ownerOperatorId: null,
      acknowledgedAt: null,
      suppressedUntil: null,
      metadata: null
    });
    (deliveryService.enqueueAlertEvent as jest.Mock).mockResolvedValue(1);

    const result = await service.recordTelemetry(
      {
        app: "customer-web",
        environment: "production",
        release: "2026.04.19",
        sessionId: "sess_1",
        timestamp: "2026-04-19T12:00:00.000Z",
        kind: "exception",
        level: "error",
        message: "Runtime crashed",
        errorName: "TypeError",
        stack: "TypeError: Runtime crashed",
        tags: {
          route: "/wallet"
        },
        context: {
          chunk: "wallet-shell"
        }
      },
      {
        requestId: "req_1",
        origin: "https://app.example.com",
        referer: "https://app.example.com/wallet",
        userAgent: "Mozilla/5.0",
        remoteAddress: "127.0.0.1"
      }
    );

    expect(prismaService.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorType: "client_app",
          actorId: "customer-web",
          action: "client_telemetry.exception",
          targetType: "ClientRuntime"
        })
      })
    );
    expect(prismaService.platformAlert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          category: PlatformAlertCategory.operations,
          severity: PlatformAlertSeverity.critical,
          status: PlatformAlertStatus.open,
          routingStatus: PlatformAlertRoutingStatus.unrouted,
          code: "client_exception",
          summary: "Customer Web exception",
          detail: "Runtime crashed"
        })
      })
    );
    expect(deliveryService.enqueueAlertEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: PlatformAlertDeliveryEventType.opened
      })
    );
    expect(result).toEqual({
      auditEventId: "audit_1",
      platformAlertId: "alert_1"
    });
  });

  it("records low-severity telemetry without raising platform alerts", async () => {
    const { service, prismaService, deliveryService } = createService();

    (prismaService.auditEvent.create as jest.Mock).mockResolvedValue({
      id: "audit_2"
    });

    const result = await service.recordTelemetry(
      {
        app: "mobile-app",
        environment: "production",
        sessionId: "sess_2",
        timestamp: "2026-04-19T12:00:00.000Z",
        kind: "message",
        level: "info",
        message: "Screen loaded"
      },
      {
        requestId: null,
        origin: null,
        referer: null,
        userAgent: null,
        remoteAddress: null
      }
    );

    expect(prismaService.platformAlert.findUnique).not.toHaveBeenCalled();
    expect(prismaService.platformAlert.create).not.toHaveBeenCalled();
    expect(deliveryService.enqueueAlertEvent).not.toHaveBeenCalled();
    expect(result).toEqual({
      auditEventId: "audit_2",
      platformAlertId: null
    });
  });
});
