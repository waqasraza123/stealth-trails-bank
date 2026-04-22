import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  NotificationCategory,
  NotificationFeedItem,
  NotificationFeedResult,
  NotificationPreferenceMatrix,
  NotificationRealtimeEnvelope,
  NotificationSocketSession,
  NotificationUnreadSummary
} from "@stealth-trails-bank/types";
import {
  archiveOperatorNotifications,
  createOperatorNotificationSocketSession,
  getOperatorNotificationPreferences,
  getOperatorNotificationUnreadSummary,
  listOperatorNotifications,
  markAllOperatorNotificationsRead,
  markOperatorNotificationsRead,
  updateOperatorNotificationPreferences
} from "@/lib/api";
import { useOperatorSession } from "@/state/operator-session";

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

const operatorNotificationPrefix = ["operator-notifications"] as const;
const operatorSummaryKey = ["operator-notifications", "summary"] as const;
const operatorPreferencesKey = ["operator-notifications", "preferences"] as const;

function buildSocketUrl(baseUrl: string, sessionToken: string) {
  const url = new URL(baseUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/notifications/ws";
  url.searchParams.set("session", sessionToken);
  return url.toString();
}

function createSequenceStorageKey(recipientKey: string) {
  return `stb:operator-notifications:sequence:${recipientKey}`;
}

function readStoredSequence(recipientKey: string): number {
  const rawValue = window.localStorage.getItem(createSequenceStorageKey(recipientKey));
  const parsed = Number(rawValue ?? "0");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function writeStoredSequence(recipientKey: string, sequence: number): void {
  if (!Number.isFinite(sequence) || sequence < 0) {
    return;
  }

  window.localStorage.setItem(createSequenceStorageKey(recipientKey), String(sequence));
}

function sortFeedItems(items: NotificationFeedItem[]) {
  return [...items].sort(
    (left, right) =>
      right.deliverySequence - left.deliverySequence ||
      Date.parse(right.eventCreatedAt) - Date.parse(left.eventCreatedAt)
  );
}

function applyFeedItemUpdate(
  current: NotificationFeedResult | undefined,
  input: NotificationQueryInput,
  item: NotificationFeedItem
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
    items: sortFeedItems(nextItems).slice(0, current.limit)
  };
}

function patchOperatorNotificationFeedCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  item: NotificationFeedItem
) {
  const queryKeys = queryClient
    .getQueryCache()
    .findAll({
      predicate: (query) =>
        Array.isArray(query.queryKey) &&
        query.queryKey[0] === operatorNotificationPrefix[0] &&
        typeof query.queryKey[2] === "object"
    })
    .map((query) => query.queryKey as [string, string | undefined, NotificationQueryInput]);

  for (const queryKey of queryKeys) {
    queryClient.setQueryData<NotificationFeedResult | undefined>(
      queryKey,
      (current) => applyFeedItemUpdate(current, queryKey[2], item)
    );
  }
}

export function useOperatorNotificationFeed(input: NotificationQueryInput = {}) {
  const { configuredSession } = useOperatorSession();

  return useQuery({
    queryKey: ["operator-notifications", configuredSession?.baseUrl, input],
    enabled: Boolean(configuredSession),
    queryFn: () => listOperatorNotifications(configuredSession!, input)
  });
}

export function useOperatorNotificationUnreadSummary() {
  const { configuredSession } = useOperatorSession();

  return useQuery({
    queryKey: ["operator-notifications", "summary"],
    enabled: Boolean(configuredSession),
    queryFn: () => getOperatorNotificationUnreadSummary(configuredSession!)
  });
}

export function useOperatorNotificationPreferences() {
  const { configuredSession } = useOperatorSession();

  return useQuery({
    queryKey: operatorPreferencesKey,
    enabled: Boolean(configuredSession),
    queryFn: () => getOperatorNotificationPreferences(configuredSession!)
  });
}

export function useUpdateOperatorNotificationPreferences() {
  const { configuredSession } = useOperatorSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (matrix: NotificationPreferenceMatrix) =>
      updateOperatorNotificationPreferences(configuredSession!, matrix),
    onSuccess: async (result) => {
      queryClient.setQueryData(operatorPreferencesKey, result);
    }
  });
}

export function useMarkOperatorNotificationsRead() {
  const { configuredSession } = useOperatorSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) =>
      markOperatorNotificationsRead(configuredSession!, ids),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === "operator-notifications"
      });
    }
  });
}

export function useMarkAllOperatorNotificationsRead() {
  const { configuredSession } = useOperatorSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => markAllOperatorNotificationsRead(configuredSession!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === "operator-notifications"
      });
    }
  });
}

export function useArchiveOperatorNotifications() {
  const { configuredSession } = useOperatorSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) =>
      archiveOperatorNotifications(configuredSession!, ids),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === "operator-notifications"
      });
    }
  });
}

export function useOperatorNotificationRealtimeBridge() {
  const { configuredSession } = useOperatorSession();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!configuredSession || typeof WebSocket === "undefined") {
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
        const session: NotificationSocketSession =
          await createOperatorNotificationSocketSession(configuredSession);
        const lastSeenSequence = Math.max(
          readStoredSequence(session.recipientKey),
          session.latestSequence
        );

        socket = new WebSocket(
          buildSocketUrl(configuredSession.baseUrl, session.socketToken)
        );

        socket.onopen = () => {
          attempts = 0;
          socket?.send(
            JSON.stringify({
              type: "notifications.resume",
              data: {
                lastSeenSequence
              }
            })
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
                    at: new Date().toISOString()
                  }
                })
              );
              return;
            }

            if (payload.type === "notifications.connected") {
              writeStoredSequence(
                payload.recipientKey,
                Math.max(payload.sequence, payload.data.latestSequence)
              );
              return;
            }

            if (payload.type === "notifications.item.created") {
              patchOperatorNotificationFeedCaches(queryClient, payload.data);
              writeStoredSequence(payload.recipientKey, payload.sequence);
              return;
            }

            if (payload.type === "notifications.item.updated") {
              patchOperatorNotificationFeedCaches(queryClient, payload.data);
              return;
            }

            if (payload.type === "notifications.unread_summary") {
              queryClient.setQueryData(operatorSummaryKey, payload.data);
              writeStoredSequence(payload.recipientKey, payload.sequence);
            }
          } catch {
            void queryClient.invalidateQueries({
              predicate: (query) =>
                Array.isArray(query.queryKey) &&
                query.queryKey[0] === "operator-notifications"
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
  }, [configuredSession, queryClient]);
}
