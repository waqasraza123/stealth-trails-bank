import { Inject, Injectable, Logger, OnModuleDestroy, forwardRef } from "@nestjs/common";
import type { IncomingMessage, Server as HttpServer } from "http";
import { randomUUID } from "crypto";
import { URL } from "url";
import { WebSocketServer, type RawData, type WebSocket } from "ws";
import type {
  NotificationFeedItem,
  NotificationRealtimeEnvelope,
  NotificationUnreadSummary,
} from "@stealth-trails-bank/types";
import { NotificationsService } from "./notifications.service";

type NotificationSocketContext = {
  connectionId: string;
  audience: "customer" | "operator";
  recipientKey: string;
  latestSequence: number;
  heartbeatIntervalMs: number;
  lastPongAt: number;
  heartbeatTimer: NodeJS.Timeout | null;
};

type BroadcastPayload =
  | NotificationRealtimeEnvelope<"notifications.item.created", NotificationFeedItem>
  | NotificationRealtimeEnvelope<"notifications.item.updated", NotificationFeedItem>
  | NotificationRealtimeEnvelope<
      "notifications.unread_summary",
      NotificationUnreadSummary
    >;

type IncomingRealtimePayload =
  | {
      type?: "ping" | "pong";
    }
  | {
      type?: "notifications.resume";
      data?: {
        lastSeenSequence?: number;
      };
    };

@Injectable()
export class NotificationsRealtimeService implements OnModuleDestroy {
  private readonly logger = new Logger(NotificationsRealtimeService.name);
  private server: WebSocketServer | null = null;
  private readonly clients = new Map<string, Map<WebSocket, NotificationSocketContext>>();

  constructor(
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService: NotificationsService,
  ) {}

  attach(httpServer: HttpServer): void {
    if (this.server) {
      return;
    }

    this.server = new WebSocketServer({ noServer: true });

    httpServer.on("upgrade", (request, socket, head) => {
      const requestUrl = request.url ?? "";

      if (!requestUrl.startsWith("/notifications/ws")) {
        return;
      }

      this.server?.handleUpgrade(request, socket, head, (ws) => {
        this.server?.emit("connection", ws, request);
      });
    });

    this.server.on("connection", async (socket, request) => {
      const context = await this.resolveSocketContext(request);

      if (!context) {
        socket.close(1008, "Unauthorized");
        return;
      }

      this.registerSocket(context.recipientKey, socket, context);
      this.sendEnvelope(socket, {
        type: "notifications.connected",
        sequence: context.latestSequence,
        occurredAt: new Date().toISOString(),
        recipientKey: context.recipientKey,
        data: {
          connectionId: context.connectionId,
          audience: context.audience,
          recipientKey: context.recipientKey,
          latestSequence: context.latestSequence,
          heartbeatIntervalMs: context.heartbeatIntervalMs,
        },
      });

      socket.on("message", async (payload) => {
        await this.handleMessage(socket, context, payload);
      });

      socket.on("close", () => {
        this.unregisterSocket(context.recipientKey, socket);
      });
    });
  }

  onModuleDestroy(): void {
    for (const sockets of this.clients.values()) {
      for (const [socket, context] of sockets.entries()) {
        if (context.heartbeatTimer) {
          clearInterval(context.heartbeatTimer);
        }
        socket.close();
      }
    }

    this.server?.close();
    this.server = null;
    this.clients.clear();
  }

  broadcastCreated(
    recipientKey: string,
    item: NotificationFeedItem,
    unreadSummary: NotificationUnreadSummary,
  ): void {
    this.broadcast(recipientKey, {
      type: "notifications.item.created",
      sequence: item.deliverySequence,
      occurredAt: item.updatedAt,
      recipientKey,
      data: item,
    });
    this.broadcast(recipientKey, {
      type: "notifications.unread_summary",
      sequence: item.deliverySequence,
      occurredAt: new Date().toISOString(),
      recipientKey,
      data: unreadSummary,
    });
  }

  broadcastUpdated(
    recipientKey: string,
    item: NotificationFeedItem,
    unreadSummary: NotificationUnreadSummary,
  ): void {
    this.broadcast(recipientKey, {
      type: "notifications.item.updated",
      sequence: item.deliverySequence,
      occurredAt: item.updatedAt,
      recipientKey,
      data: item,
    });
    this.broadcast(recipientKey, {
      type: "notifications.unread_summary",
      sequence: item.deliverySequence,
      occurredAt: new Date().toISOString(),
      recipientKey,
      data: unreadSummary,
    });
  }

  private async resolveSocketContext(
    request: IncomingMessage,
  ): Promise<NotificationSocketContext | null> {
    const url = new URL(request.url ?? "/notifications/ws", "http://localhost");
    const sessionToken = url.searchParams.get("session");

    if (!sessionToken) {
      return null;
    }

    const session =
      await this.notificationsService.validateSocketSessionToken(sessionToken);

    if (!session) {
      return null;
    }

    return {
      connectionId: randomUUID(),
      audience: session.audience,
      recipientKey: session.recipientKey,
      latestSequence: session.latestSequence,
      heartbeatIntervalMs: session.heartbeatIntervalMs,
      lastPongAt: Date.now(),
      heartbeatTimer: null,
    };
  }

  private registerSocket(
    recipientKey: string,
    socket: WebSocket,
    context: NotificationSocketContext,
  ): void {
    const sockets =
      this.clients.get(recipientKey) ??
      new Map<WebSocket, NotificationSocketContext>();

    context.heartbeatTimer = setInterval(() => {
      if (Date.now() - context.lastPongAt > context.heartbeatIntervalMs * 2) {
        socket.close(1011, "Heartbeat timed out");
        return;
      }

      this.send(socket, {
        type: "ping",
        data: {
          at: new Date().toISOString(),
        },
      });
    }, context.heartbeatIntervalMs);

    sockets.set(socket, context);
    this.clients.set(recipientKey, sockets);
  }

  private unregisterSocket(recipientKey: string, socket: WebSocket): void {
    const sockets = this.clients.get(recipientKey);

    if (!sockets) {
      return;
    }

    const context = sockets.get(socket);

    if (context?.heartbeatTimer) {
      clearInterval(context.heartbeatTimer);
    }

    sockets.delete(socket);

    if (sockets.size === 0) {
      this.clients.delete(recipientKey);
    }
  }

  private async handleMessage(
    socket: WebSocket,
    context: NotificationSocketContext,
    payload: RawData,
  ): Promise<void> {
    try {
      const parsed = JSON.parse(String(payload)) as IncomingRealtimePayload;

      if (parsed.type === "pong" || parsed.type === "ping") {
        context.lastPongAt = Date.now();

        if (parsed.type === "ping") {
          this.send(socket, {
            type: "pong",
            data: {
              at: new Date().toISOString(),
            },
          });
        }

        return;
      }

      if (parsed.type === "notifications.resume") {
        const lastSeenSequence =
          typeof parsed.data?.lastSeenSequence === "number"
            ? Math.max(0, parsed.data.lastSeenSequence)
            : 0;

        const replayEvents =
          await this.notificationsService.listRealtimeEventsAfterSequence(
            context.recipientKey,
            lastSeenSequence,
          );

        for (const event of replayEvents) {
          this.sendEnvelope(socket, {
            type: "notifications.item.created",
            sequence: event.item.deliverySequence,
            occurredAt: event.item.updatedAt,
            recipientKey: context.recipientKey,
            data: event.item,
          });
          this.sendEnvelope(socket, {
            type: "notifications.unread_summary",
            sequence: event.item.deliverySequence,
            occurredAt: new Date().toISOString(),
            recipientKey: context.recipientKey,
            data: event.unreadSummary,
          });
        }

        return;
      }

      this.send(socket, {
        type: "notifications.error",
        data: {
          message: "Unsupported realtime payload.",
        },
      });
    } catch (error) {
      this.logger.warn(
        `Notification websocket payload handling failed: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
      this.send(socket, {
        type: "notifications.error",
        data: {
          message: "Unsupported realtime payload.",
        },
      });
    }
  }

  private broadcast(recipientKey: string, payload: BroadcastPayload): void {
    const sockets = this.clients.get(recipientKey);

    if (!sockets || sockets.size === 0) {
      return;
    }

    for (const [socket] of sockets.entries()) {
      this.sendEnvelope(socket, payload);
    }
  }

  private sendEnvelope(socket: WebSocket, payload: BroadcastPayload | NotificationRealtimeEnvelope<"notifications.connected", {
    connectionId: string;
    audience: "customer" | "operator";
    recipientKey: string;
    latestSequence: number;
    heartbeatIntervalMs: number;
  }>): void {
    this.send(socket, payload);
  }

  private send(socket: WebSocket, payload: unknown): void {
    if (socket.readyState !== socket.OPEN) {
      return;
    }

    socket.send(JSON.stringify(payload));
  }
}
