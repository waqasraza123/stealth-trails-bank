import { Injectable, OnModuleDestroy } from "@nestjs/common";
import type { IncomingMessage, Server as HttpServer } from "http";
import { URL } from "url";
import { WebSocketServer, type WebSocket } from "ws";
import { AuthService } from "../auth/auth.service";
import { OperatorIdentityService } from "../auth/operator-identity.service";
import { PrismaService } from "../prisma/prisma.service";
import type {
  NotificationFeedItem,
  NotificationUnreadSummary,
} from "@stealth-trails-bank/types";
import { buildNotificationRecipientKey } from "./notification-preferences.util";

type NotificationSocketContext = {
  audience: "customer" | "operator";
  recipientId: string;
  recipientKey: string;
};

@Injectable()
export class NotificationsRealtimeService implements OnModuleDestroy {
  private server: WebSocketServer | null = null;
  private readonly clients = new Map<string, Set<WebSocket>>();

  constructor(
    private readonly prismaService: PrismaService,
    private readonly authService: AuthService,
    private readonly operatorIdentityService: OperatorIdentityService,
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

      this.registerSocket(context.recipientKey, socket);
      this.send(socket, {
        type: "notifications.connected",
        data: {
          audience: context.audience,
          recipientKey: context.recipientKey,
          connectedAt: new Date().toISOString(),
        },
      });

      socket.on("message", (payload) => {
        try {
          const parsed = JSON.parse(String(payload)) as { type?: string };

          if (parsed.type === "ping") {
            this.send(socket, {
              type: "pong",
              data: {
                at: new Date().toISOString(),
              },
            });
          }
        } catch {
          this.send(socket, {
            type: "notifications.error",
            data: {
              message: "Unsupported realtime payload.",
            },
          });
        }
      });

      socket.on("close", () => {
        this.unregisterSocket(context.recipientKey, socket);
      });
    });
  }

  onModuleDestroy(): void {
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
      data: item,
    });
    this.broadcast(recipientKey, {
      type: "notifications.unread_summary",
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
      data: item,
    });
    this.broadcast(recipientKey, {
      type: "notifications.unread_summary",
      data: unreadSummary,
    });
  }

  private async resolveSocketContext(
    request: IncomingMessage,
  ): Promise<NotificationSocketContext | null> {
    const url = new URL(
      request.url ?? "/notifications/ws",
      "http://localhost",
    );
    const audience = url.searchParams.get("audience");
    const token = url.searchParams.get("token");

    if (!token || (audience !== "customer" && audience !== "operator")) {
      return null;
    }

    if (audience === "customer") {
      const session = await this.authService.validateToken(token);
      const customer = await this.prismaService.customer.findUnique({
        where: {
          supabaseUserId: session.id,
        },
        select: {
          id: true,
        },
      });

      if (!customer) {
        return null;
      }

      return {
        audience,
        recipientId: customer.id,
        recipientKey: buildNotificationRecipientKey(audience, customer.id),
      };
    }

    const resolvedOperator =
      await this.operatorIdentityService.resolveFromBearerToken({
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

    if (!resolvedOperator?.operatorDbId) {
      return null;
    }

    return {
      audience,
      recipientId: resolvedOperator.operatorDbId,
      recipientKey: buildNotificationRecipientKey(
        audience,
        resolvedOperator.operatorDbId,
      ),
    };
  }

  private registerSocket(recipientKey: string, socket: WebSocket): void {
    const sockets = this.clients.get(recipientKey) ?? new Set<WebSocket>();
    sockets.add(socket);
    this.clients.set(recipientKey, sockets);
  }

  private unregisterSocket(recipientKey: string, socket: WebSocket): void {
    const sockets = this.clients.get(recipientKey);

    if (!sockets) {
      return;
    }

    sockets.delete(socket);

    if (sockets.size === 0) {
      this.clients.delete(recipientKey);
    }
  }

  private broadcast(recipientKey: string, payload: unknown): void {
    const sockets = this.clients.get(recipientKey);

    if (!sockets || sockets.size === 0) {
      return;
    }

    for (const socket of sockets) {
      this.send(socket, payload);
    }
  }

  private send(socket: WebSocket, payload: unknown): void {
    if (socket.readyState !== socket.OPEN) {
      return;
    }

    socket.send(JSON.stringify(payload));
  }
}
