import { useEffect } from "react";
import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  NotificationCategory,
  NotificationFeedItem,
  NotificationFeedResult,
  NotificationPreferenceMatrix,
  NotificationRealtimeEnvelope,
  NotificationSocketSession,
  NotificationUnreadSummary,
} from "@stealth-trails-bank/types";
import { loadWebRuntimeConfig } from "@stealth-trails-bank/config/web";
import { readApiErrorMessage, type ApiResponse } from "@/lib/api";
import { useUserStore } from "@/stores/userStore";

const webRuntimeConfig = loadWebRuntimeConfig(
  import.meta.env as Record<string, string | boolean | undefined>,
);

type NotificationListInput = {
  limit?: number;
  unreadOnly?: boolean;
  category?: NotificationCategory;
};

type NotificationConnectedPayload = {
  connectionId: string;
  audience: "customer" | "operator";
  recipientKey: string;
  latestSequence: number;
  heartbeatIntervalMs: number;
};

const customerNotificationPrefix = ["notifications", "customer"] as const;
const unreadSummaryKey = ["notifications", "customer", "unread-summary"] as const;

function buildHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "x-stb-client-platform": "web",
  };
}

function buildSocketUrl(socketToken: string) {
  const url = new URL(webRuntimeConfig.serverUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/notifications/ws";
  url.searchParams.set("session", socketToken);
  return url.toString();
}

function createSequenceStorageKey(recipientKey: string) {
  return `stb:notifications:sequence:${recipientKey}`;
}

function readStoredSequence(recipientKey: string): number {
  if (typeof window === "undefined") {
    return 0;
  }

  const rawValue = window.localStorage.getItem(
    createSequenceStorageKey(recipientKey),
  );
  const parsed = Number(rawValue ?? "0");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function writeStoredSequence(recipientKey: string, sequence: number): void {
  if (typeof window === "undefined" || !Number.isFinite(sequence) || sequence < 0) {
    return;
  }

  window.localStorage.setItem(
    createSequenceStorageKey(recipientKey),
    String(sequence),
  );
}

function sortFeedItems(items: NotificationFeedItem[]) {
  return [...items].sort(
    (left, right) =>
      right.deliverySequence - left.deliverySequence ||
      Date.parse(right.eventCreatedAt) - Date.parse(left.eventCreatedAt),
  );
}

function applyFeedItemUpdate(
  current: NotificationFeedResult | undefined,
  input: NotificationListInput,
  item: NotificationFeedItem,
): NotificationFeedResult | undefined {
  if (!current) {
    return current;
  }

  const matchesFilter =
    !item.archivedAt &&
    (!input.category || item.category === input.category) &&
    (!input.unreadOnly || !item.readAt);

  const existingItems = current.items.filter((candidate) => candidate.id !== item.id);
  const nextItems = matchesFilter ? [item, ...existingItems] : existingItems;

  return {
    ...current,
    items: sortFeedItems(nextItems).slice(0, current.limit),
  };
}

async function createCustomerSocketSession(token: string) {
  const response = await axios.post<ApiResponse<NotificationSocketSession>>(
    `${webRuntimeConfig.serverUrl}/notifications/me/socket-session`,
    {},
    {
      headers: buildHeaders(token),
    },
  );

  if (response.data.status !== "success" || !response.data.data) {
    throw new Error(
      response.data.message || "Failed to create notification socket session.",
    );
  }

  return response.data.data;
}

function patchNotificationFeedCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  item: NotificationFeedItem,
) {
  const queries = queryClient
    .getQueryCache()
    .findAll({
      predicate: (query) =>
        Array.isArray(query.queryKey) &&
        query.queryKey[0] === customerNotificationPrefix[0] &&
        query.queryKey[1] === customerNotificationPrefix[1] &&
        typeof query.queryKey[2] === "object",
    })
    .map((query) => query.queryKey as [string, string, NotificationListInput]);

  for (const queryKey of queries) {
    queryClient.setQueryData<NotificationFeedResult | undefined>(
      queryKey,
      (current) => applyFeedItemUpdate(current, queryKey[2], item),
    );
  }
}

export function useNotificationFeed(input: NotificationListInput = {}) {
  const token = useUserStore((state) => state.token);

  return useQuery({
    queryKey: ["notifications", "customer", input],
    enabled: Boolean(token),
    queryFn: async () => {
      if (!token) {
        throw new Error("Auth token is required.");
      }

      try {
        const response = await axios.get<ApiResponse<NotificationFeedResult>>(
          `${webRuntimeConfig.serverUrl}/notifications/me`,
          {
            headers: buildHeaders(token),
            params: {
              limit: input.limit ?? 25,
              unreadOnly: input.unreadOnly,
              category: input.category,
            },
          },
        );

        if (response.data.status !== "success" || !response.data.data) {
          throw new Error(response.data.message || "Failed to load notifications.");
        }

        return response.data.data;
      } catch (error) {
        throw new Error(readApiErrorMessage(error, "Failed to load notifications."));
      }
    },
  });
}

export function useNotificationUnreadSummary() {
  const token = useUserStore((state) => state.token);

  return useQuery({
    queryKey: unreadSummaryKey,
    enabled: Boolean(token),
    queryFn: async () => {
      if (!token) {
        throw new Error("Auth token is required.");
      }

      try {
        const response = await axios.get<ApiResponse<NotificationUnreadSummary>>(
          `${webRuntimeConfig.serverUrl}/notifications/me/unread-count`,
          {
            headers: buildHeaders(token),
          },
        );

        if (response.data.status !== "success" || !response.data.data) {
          throw new Error(
            response.data.message || "Failed to load notification summary.",
          );
        }

        return response.data.data;
      } catch (error) {
        throw new Error(
          readApiErrorMessage(error, "Failed to load notification summary."),
        );
      }
    },
  });
}

export function useMarkNotificationsRead() {
  const token = useUserStore((state) => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (!token) {
        throw new Error("Auth token is required.");
      }

      const response = await axios.post<ApiResponse<NotificationFeedResult>>(
        `${webRuntimeConfig.serverUrl}/notifications/me/mark-read`,
        { ids },
        {
          headers: buildHeaders(token),
        },
      );

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(
          response.data.message || "Failed to mark notifications as read.",
        );
      }

      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) && query.queryKey[0] === "notifications",
      });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const token = useUserStore((state) => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!token) {
        throw new Error("Auth token is required.");
      }

      const response = await axios.post<ApiResponse<NotificationUnreadSummary>>(
        `${webRuntimeConfig.serverUrl}/notifications/me/mark-all-read`,
        {},
        {
          headers: buildHeaders(token),
        },
      );

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(
          response.data.message || "Failed to mark all notifications as read.",
        );
      }

      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) && query.queryKey[0] === "notifications",
      });
    },
  });
}

export function useArchiveNotifications() {
  const token = useUserStore((state) => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (!token) {
        throw new Error("Auth token is required.");
      }

      const response = await axios.post<ApiResponse<NotificationFeedResult>>(
        `${webRuntimeConfig.serverUrl}/notifications/me/archive`,
        { ids },
        {
          headers: buildHeaders(token),
        },
      );

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(
          response.data.message || "Failed to archive notifications.",
        );
      }

      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) && query.queryKey[0] === "notifications",
      });
    },
  });
}

export function useNotificationRealtimeBridge() {
  const token = useUserStore((state) => state.token);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!token || typeof WebSocket === "undefined") {
      return;
    }

    let reconnectTimer: number | null = null;
    let socket: WebSocket | null = null;
    let attempts = 0;
    let disposed = false;

    const clearReconnectTimer = () => {
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const scheduleReconnect = () => {
      if (disposed) {
        return;
      }

      clearReconnectTimer();
      const delayMs =
        Math.min(30_000, 1_000 * 2 ** attempts) + Math.floor(Math.random() * 250);
      attempts += 1;

      reconnectTimer = window.setTimeout(() => {
        void connect();
      }, delayMs);
    };

    const connect = async () => {
      try {
        const session = await createCustomerSocketSession(token);
        const lastSeenSequence = Math.max(
          readStoredSequence(session.recipientKey),
          session.latestSequence,
        );

        socket = new WebSocket(buildSocketUrl(session.socketToken));

        socket.onopen = () => {
          attempts = 0;
          socket?.send(
            JSON.stringify({
              type: "notifications.resume",
              data: {
                lastSeenSequence,
              },
            }),
          );
        };

        socket.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data) as
              | NotificationRealtimeEnvelope<
                  "notifications.connected",
                  NotificationConnectedPayload
                >
              | NotificationRealtimeEnvelope<
                  "notifications.item.created",
                  NotificationFeedItem
                >
              | NotificationRealtimeEnvelope<
                  "notifications.item.updated",
                  NotificationFeedItem
                >
              | NotificationRealtimeEnvelope<
                  "notifications.unread_summary",
                  NotificationUnreadSummary
                >
              | { type?: "ping" | "pong"; data?: { at?: string } };

            if (payload.type === "ping") {
              socket?.send(
                JSON.stringify({
                  type: "pong",
                  data: {
                    at: new Date().toISOString(),
                  },
                }),
              );
              return;
            }

            if (payload.type === "notifications.connected") {
              writeStoredSequence(
                payload.recipientKey,
                Math.max(payload.sequence, payload.data.latestSequence),
              );
              return;
            }

            if (payload.type === "notifications.item.created") {
              patchNotificationFeedCaches(queryClient, payload.data);
              writeStoredSequence(payload.recipientKey, payload.sequence);
              return;
            }

            if (payload.type === "notifications.item.updated") {
              patchNotificationFeedCaches(queryClient, payload.data);
              return;
            }

            if (payload.type === "notifications.unread_summary") {
              queryClient.setQueryData(unreadSummaryKey, payload.data);
              writeStoredSequence(payload.recipientKey, payload.sequence);
            }
          } catch {
            void queryClient.invalidateQueries({
              predicate: (query) =>
                Array.isArray(query.queryKey) && query.queryKey[0] === "notifications",
            });
          }
        };

        socket.onerror = () => {
          socket?.close();
        };

        socket.onclose = () => {
          socket = null;
          scheduleReconnect();
        };
      } catch {
        scheduleReconnect();
      }
    };

    void connect();

    return () => {
      disposed = true;
      clearReconnectTimer();
      socket?.close();
    };
  }, [queryClient, token]);
}

export function useNotificationPreferencesMatrix() {
  const token = useUserStore((state) => state.token);

  return useQuery({
    queryKey: ["notifications", "customer", "preferences"],
    enabled: Boolean(token),
    queryFn: async () => {
      if (!token) {
        throw new Error("Auth token is required.");
      }

      try {
        const response = await axios.get<
          ApiResponse<{ notificationPreferences: NotificationPreferenceMatrix }>
        >(`${webRuntimeConfig.serverUrl}/notifications/me/preferences`, {
          headers: buildHeaders(token),
        });

        if (response.data.status !== "success" || !response.data.data) {
          throw new Error(
            response.data.message || "Failed to load notification preferences.",
          );
        }

        return response.data.data.notificationPreferences;
      } catch (error) {
        throw new Error(
          readApiErrorMessage(error, "Failed to load notification preferences."),
        );
      }
    },
  });
}
