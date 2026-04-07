import axios from "axios";
import {
  PlatformAlertCategory,
  PlatformAlertDeliveryStatus,
  PlatformAlertSeverity,
  PlatformAlertStatus
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { PlatformAlertDeliveryService } from "./platform-alert-delivery.service";

jest.mock("axios");
jest.mock("@stealth-trails-bank/config/api", () => ({
  loadPlatformAlertDeliveryRuntimeConfig: () => ({
    requestTimeoutMs: 5000,
    targets: [
      {
        name: "ops-critical",
        url: "https://ops.example.com/hooks/platform-alerts",
        bearerToken: "secret-token",
        deliveryMode: "direct",
        categories: ["worker", "queue"],
        minimumSeverity: "critical",
        eventTypes: ["opened", "acknowledged", "routed_to_review_case"],
        failoverTargetNames: ["ops-failover"]
      },
      {
        name: "ops-failover",
        url: "https://pager.example.com/hooks/platform-alerts",
        bearerToken: "failover-token",
        deliveryMode: "failover_only",
        categories: ["worker", "queue"],
        minimumSeverity: "critical",
        eventTypes: ["opened", "acknowledged", "routed_to_review_case"],
        failoverTargetNames: []
      }
    ]
  })
}));

function buildAlertPayload() {
  return {
    id: "alert_1",
    dedupeKey: "worker:degraded:worker_1",
    category: PlatformAlertCategory.worker,
    severity: PlatformAlertSeverity.critical,
    status: PlatformAlertStatus.open,
    summary: "Worker worker_1 is degraded.",
    detail: "RPC timeout",
    routingStatus: "unrouted",
    ownerOperatorId: null,
    acknowledgedAt: null,
    suppressedUntil: null,
    metadata: {
      workerId: "worker_1"
    }
  };
}

function createService() {
  const prismaService = {
    platformAlertDelivery: {
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn()
    }
  } as unknown as PrismaService;

  return {
    prismaService,
    service: new PlatformAlertDeliveryService(prismaService)
  };
}

describe("PlatformAlertDeliveryService", () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("enqueues and delivers matching alert events", async () => {
    const { service, prismaService } = createService();

    (prismaService.platformAlertDelivery.create as jest.Mock).mockResolvedValue({
      id: "delivery_1"
    });
    (prismaService.platformAlertDelivery.findMany as jest.Mock).mockResolvedValue([
      {
        id: "delivery_1",
        targetName: "ops-critical",
        targetUrl: "https://ops.example.com/hooks/platform-alerts",
        eventType: "opened",
        status: PlatformAlertDeliveryStatus.pending,
        attemptCount: 0,
        escalationLevel: 0,
        requestPayload: {
          alert: buildAlertPayload()
        }
      }
    ]);
    (prismaService.platformAlertDelivery.findUnique as jest.Mock).mockResolvedValue({
      id: "delivery_1",
      platformAlertId: "alert_1",
      targetName: "ops-critical",
      targetUrl: "https://ops.example.com/hooks/platform-alerts",
      eventType: "opened",
      status: PlatformAlertDeliveryStatus.pending,
      attemptCount: 0,
      escalationLevel: 0,
      requestPayload: {
        alert: buildAlertPayload()
      }
    });
    (axios.post as jest.Mock).mockResolvedValue({
      status: 202
    });

    const queuedCount = await service.enqueueAlertEvent({
      alert: buildAlertPayload(),
      eventType: "opened"
    });
    await new Promise((resolve) => setImmediate(resolve));

    expect(queuedCount).toBe(1);
    expect(prismaService.platformAlertDelivery.create).toHaveBeenCalledTimes(1);
    expect(axios.post).toHaveBeenCalledWith(
      "https://ops.example.com/hooks/platform-alerts",
      expect.anything(),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer secret-token"
        }),
        timeout: 5000
      })
    );
    expect(prismaService.platformAlertDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: PlatformAlertDeliveryStatus.succeeded,
          responseStatusCode: 202
        })
      })
    );
  });

  it("enqueues failover deliveries after a primary delivery failure", async () => {
    const { service, prismaService } = createService();
    const alertPayload = {
      alert: buildAlertPayload(),
      metadata: {
        policyName: "critical-worker-auto-route"
      }
    };

    (prismaService.platformAlertDelivery.create as jest.Mock)
      .mockResolvedValueOnce({
        id: "delivery_1"
      })
      .mockResolvedValueOnce({
        id: "delivery_2"
      });
    (prismaService.platformAlertDelivery.findMany as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: "delivery_1",
          platformAlertId: "alert_1",
          targetName: "ops-critical",
          targetUrl: "https://ops.example.com/hooks/platform-alerts",
          eventType: "opened",
          status: PlatformAlertDeliveryStatus.pending,
          attemptCount: 0,
          escalationLevel: 0,
          requestPayload: alertPayload
        }
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "delivery_2",
          platformAlertId: "alert_1",
          targetName: "ops-failover",
          targetUrl: "https://pager.example.com/hooks/platform-alerts",
          eventType: "opened",
          status: PlatformAlertDeliveryStatus.pending,
          attemptCount: 0,
          escalationLevel: 1,
          escalatedFromDeliveryId: "delivery_1",
          requestPayload: {
            ...alertPayload,
            delivery: {
              escalatedFromDeliveryId: "delivery_1",
              escalatedFromTargetName: "ops-critical",
              escalationLevel: 1,
              escalationReason: "delivery_failed"
            }
          }
        }
      ]);
    (prismaService.platformAlertDelivery.findUnique as jest.Mock)
      .mockResolvedValueOnce({
        id: "delivery_1",
        platformAlertId: "alert_1",
        targetName: "ops-critical",
        targetUrl: "https://ops.example.com/hooks/platform-alerts",
        eventType: "opened",
        status: PlatformAlertDeliveryStatus.pending,
        attemptCount: 0,
        escalationLevel: 0,
        requestPayload: alertPayload
      })
      .mockResolvedValueOnce({
        id: "delivery_1",
        platformAlertId: "alert_1",
        targetName: "ops-critical",
        targetUrl: "https://ops.example.com/hooks/platform-alerts",
        eventType: "opened",
        status: PlatformAlertDeliveryStatus.failed,
        attemptCount: 1,
        escalationLevel: 0,
        requestPayload: alertPayload
      })
      .mockResolvedValueOnce({
        id: "delivery_2",
        platformAlertId: "alert_1",
        targetName: "ops-failover",
        targetUrl: "https://pager.example.com/hooks/platform-alerts",
        eventType: "opened",
        status: PlatformAlertDeliveryStatus.pending,
        attemptCount: 0,
        escalationLevel: 1,
        requestPayload: alertPayload
      });
    (axios.post as jest.Mock)
      .mockRejectedValueOnce(new Error("Primary target unavailable"))
      .mockResolvedValueOnce({
        status: 202
      });

    const queuedCount = await service.enqueueAlertEvent({
      alert: buildAlertPayload(),
      eventType: "opened",
      metadata: {
        policyName: "critical-worker-auto-route"
      }
    });
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));

    expect(queuedCount).toBe(1);
    expect(prismaService.platformAlertDelivery.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          targetName: "ops-failover",
          escalatedFromDeliveryId: "delivery_1",
          escalationLevel: 1,
          escalationReason: "delivery_failed"
        })
      })
    );
    expect(axios.post).toHaveBeenNthCalledWith(
      2,
      "https://pager.example.com/hooks/platform-alerts",
      expect.anything(),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer failover-token",
          "X-Stealth-Trails-Alert-Escalation-Level": "1"
        })
      })
    );
  });

  it("requeues failed deliveries for retry", async () => {
    const { service, prismaService } = createService();

    (prismaService.platformAlertDelivery.findMany as jest.Mock)
      .mockResolvedValueOnce([{ id: "delivery_1" }])
      .mockResolvedValueOnce([]);
    (prismaService.platformAlertDelivery.updateMany as jest.Mock).mockResolvedValue({
      count: 1
    });

    const queuedCount = await service.retryFailedDeliveriesForAlert("alert_1");

    expect(queuedCount).toBe(1);
    expect(prismaService.platformAlertDelivery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: PlatformAlertDeliveryStatus.pending
        })
      })
    );
  });
});
