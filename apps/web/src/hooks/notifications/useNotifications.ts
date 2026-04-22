import { useEffect } from "react";
import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  NotificationCategory,
  NotificationFeedResult,
  NotificationPreferenceMatrix,
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

function buildHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "x-stb-client-platform": "web",
  };
}

function buildSocketUrl(token: string) {
  const url = new URL(webRuntimeConfig.serverUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/notifications/ws";
  url.searchParams.set("audience", "customer");
  url.searchParams.set("token", token);
  return url.toString();
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
    queryKey: ["notifications", "customer", "unread-summary"],
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
              query.queryKey[0] === "notifications",
          });
        }
      } catch {
        // Ignore malformed realtime payloads and rely on normal polling.
      }
    };

    return () => {
      socket.close();
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
    },
  });
}
