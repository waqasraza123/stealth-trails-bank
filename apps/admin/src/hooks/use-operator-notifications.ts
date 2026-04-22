import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NotificationCategory } from "@stealth-trails-bank/types";
import {
  archiveOperatorNotifications,
  getOperatorNotificationUnreadSummary,
  listOperatorNotifications,
  markAllOperatorNotificationsRead,
  markOperatorNotificationsRead
} from "@/lib/api";
import { useOperatorSession } from "@/state/operator-session";

type NotificationQueryInput = {
  limit?: number;
  unreadOnly?: boolean;
  category?: NotificationCategory;
};

function buildSocketUrl(baseUrl: string, token: string) {
  const url = new URL(baseUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/notifications/ws";
  url.searchParams.set("audience", "operator");
  url.searchParams.set("token", token);
  return url.toString();
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
    queryKey: ["operator-notifications", configuredSession?.baseUrl, "summary"],
    enabled: Boolean(configuredSession),
    queryFn: () => getOperatorNotificationUnreadSummary(configuredSession!)
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
    if (
      !configuredSession?.accessToken ||
      typeof WebSocket === "undefined"
    ) {
      return;
    }

    const socket = new WebSocket(
      buildSocketUrl(configuredSession.baseUrl, configuredSession.accessToken)
    );

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as { type?: string };

        if (
          payload.type === "notifications.item.created" ||
          payload.type === "notifications.item.updated" ||
          payload.type === "notifications.unread_summary"
        ) {
          void queryClient.invalidateQueries({
            predicate: (query) =>
              Array.isArray(query.queryKey) &&
              query.queryKey[0] === "operator-notifications"
          });
        }
      } catch {
        // Ignore malformed payloads and rely on normal refresh.
      }
    };

    return () => {
      socket.close();
    };
  }, [configuredSession?.accessToken, configuredSession?.baseUrl, queryClient]);
}
