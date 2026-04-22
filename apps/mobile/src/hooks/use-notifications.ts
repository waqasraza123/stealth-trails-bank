import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  NotificationCategory,
  NotificationFeedResult,
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

function buildSocketUrl(token: string) {
  const baseUrl = apiClient.defaults.baseURL ?? "";
  const url = new URL(baseUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/notifications/ws";
  url.searchParams.set("audience", "customer");
  url.searchParams.set("token", token);
  return url.toString();
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
    queryKey: ["mobile-notifications", "summary"],
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

    const socket = new WebSocket(buildSocketUrl(token));

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
              query.queryKey[0] === "mobile-notifications",
          });
        }
      } catch {
        // Ignore malformed realtime payloads and rely on normal refresh.
      }
    };

    return () => {
      socket.close();
    };
  }, [queryClient, token]);
}
