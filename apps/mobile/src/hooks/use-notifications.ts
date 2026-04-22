import { useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  NotificationCategory,
  NotificationFeedItem,
  NotificationFeedResult,
  NotificationRealtimeEnvelope,
  NotificationSocketSession,
  NotificationUnreadSummary,
} from "@stealth-trails-bank/types";
import { apiClient } from "../lib/api/client";
import type { ApiEnvelope } from "../lib/api/types";
import { useSessionStore } from "../stores/session-store";

type NotificationQueryInput = {
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

const notificationPrefix = ["mobile-notifications"] as const;
const notificationSummaryKey = ["mobile-notifications", "summary"] as const;

function buildSocketUrl(sessionToken: string) {
  const baseUrl = apiClient.defaults.baseURL ?? "";
  const url = new URL(baseUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/notifications/ws";
  url.searchParams.set("session", sessionToken);
  return url.toString();
}

function createSequenceStorageKey(recipientKey: string) {
  return `stb:mobile-notifications:sequence:${recipientKey}`;
}

async function readStoredSequence(recipientKey: string): Promise<number> {
  const rawValue = await AsyncStorage.getItem(createSequenceStorageKey(recipientKey));
  const parsed = Number(rawValue ?? "0");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

async function writeStoredSequence(recipientKey: string, sequence: number) {
  if (!Number.isFinite(sequence) || sequence < 0) {
    return;
  }

  await AsyncStorage.setItem(createSequenceStorageKey(recipientKey), String(sequence));
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
  input: NotificationQueryInput,
  item: NotificationFeedItem,
): NotificationFeedResult | undefined {
  if (!current) {
    return current;
  }

  const matchesFilter =
    !item.archivedAt &&
    (!input.category || item.category === input.category) &&
    (!input.unreadOnly || !item.readAt);
  const nextItems = matchesFilter
    ? [item, ...current.items.filter((candidate) => candidate.id !== item.id)]
    : current.items.filter((candidate) => candidate.id !== item.id);

  return {
    ...current,
    items: sortFeedItems(nextItems).slice(0, current.limit),
  };
}

function patchNotificationFeedCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  item: NotificationFeedItem,
) {
  const queryKeys = queryClient
    .getQueryCache()
    .findAll({
      predicate: (query) =>
        Array.isArray(query.queryKey) &&
        query.queryKey[0] === notificationPrefix[0] &&
        typeof query.queryKey[1] === "object",
    })
    .map((query) => query.queryKey as [string, NotificationQueryInput]);

  for (const queryKey of queryKeys) {
    queryClient.setQueryData<NotificationFeedResult | undefined>(
      queryKey,
      (current) => applyFeedItemUpdate(current, queryKey[1], item),
    );
  }
}

async function createCustomerSocketSession() {
  const response = await apiClient.post<ApiEnvelope<NotificationSocketSession>>(
    "/notifications/me/socket-session",
    {},
  );

  if (response.data.status !== "success" || !response.data.data) {
    throw new Error(
      response.data.message || "Failed to create notification socket session.",
    );
  }

  return response.data.data;
}

export function useNotificationsQuery(input: NotificationQueryInput = {}) {
  const token = useSessionStore((state) => state.token);

  return useQuery({
    queryKey: ["mobile-notifications", input],
    enabled: Boolean(token),
    queryFn: async () => {
      const response = await apiClient.get<ApiEnvelope<NotificationFeedResult>>(
        "/notifications/me",
        {
          params: {
            limit: input.limit ?? 50,
            unreadOnly: input.unreadOnly,
            category: input.category,
          },
        },
      );

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(response.data.message || "Failed to load notifications.");
      }

      return response.data.data;
    },
  });
}

export function useNotificationUnreadSummaryQuery() {
  const token = useSessionStore((state) => state.token);

  return useQuery({
    queryKey: notificationSummaryKey,
    enabled: Boolean(token),
    queryFn: async () => {
      const response = await apiClient.get<ApiEnvelope<NotificationUnreadSummary>>(
        "/notifications/me/unread-count",
      );

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(
          response.data.message || "Failed to load notification summary.",
        );
      }

      return response.data.data;
    },
  });
}

export function useMarkNotificationsReadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const response = await apiClient.post<ApiEnvelope<NotificationFeedResult>>(
        "/notifications/me/mark-read",
        { ids },
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
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === "mobile-notifications",
      });
    },
  });
}

export function useMarkAllNotificationsReadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<ApiEnvelope<NotificationUnreadSummary>>(
        "/notifications/me/mark-all-read",
        {},
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
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === "mobile-notifications",
      });
    },
  });
}

export function useArchiveNotificationsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const response = await apiClient.post<ApiEnvelope<NotificationFeedResult>>(
        "/notifications/me/archive",
        { ids },
      );

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(response.data.message || "Failed to archive notifications.");
      }

      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === "mobile-notifications",
      });
    },
  });
}

export function useNotificationRealtimeBridge() {
  const token = useSessionStore((state) => state.token);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!token) {
      return;
    }

    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let socket: WebSocket | null = null;
    let attempts = 0;
    let disposed = false;

    const clearReconnectTimer = () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
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
      reconnectTimer = setTimeout(() => {
        void connect();
      }, delayMs);
    };

    const connect = async () => {
      try {
        const session = await createCustomerSocketSession();
        const lastSeenSequence = Math.max(
          await readStoredSequence(session.recipientKey),
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
          void (async () => {
            try {
              const payload = JSON.parse(event.data as string) as
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
                await writeStoredSequence(
                  payload.recipientKey,
                  Math.max(payload.sequence, payload.data.latestSequence),
                );
                return;
              }

              if (payload.type === "notifications.item.created") {
                patchNotificationFeedCaches(queryClient, payload.data);
                await writeStoredSequence(payload.recipientKey, payload.sequence);
                return;
              }

              if (payload.type === "notifications.item.updated") {
                patchNotificationFeedCaches(queryClient, payload.data);
                return;
              }

              if (payload.type === "notifications.unread_summary") {
                queryClient.setQueryData(notificationSummaryKey, payload.data);
                await writeStoredSequence(payload.recipientKey, payload.sequence);
              }
            } catch {
              await queryClient.invalidateQueries({
                predicate: (query) =>
                  Array.isArray(query.queryKey) &&
                  query.queryKey[0] === "mobile-notifications",
              });
            }
          })();
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
