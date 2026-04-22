import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Notifications from "@/pages/Notifications";
import { CustomerNotificationBell } from "@/components/notifications/CustomerNotificationBell";
import { useUserStore } from "@/stores/userStore";
import { renderWithRouter } from "@/test/render-with-router";
import {
  useArchiveNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationsRead,
  useNotificationFeed,
  useNotificationRealtimeBridge,
  useNotificationUnreadSummary,
} from "@/hooks/notifications/useNotifications";

const mockUseNotificationFeed = vi.mocked(useNotificationFeed);
const mockUseNotificationUnreadSummary = vi.mocked(useNotificationUnreadSummary);
const mockUseMarkNotificationsRead = vi.mocked(useMarkNotificationsRead);
const mockUseMarkAllNotificationsRead = vi.mocked(useMarkAllNotificationsRead);
const mockUseArchiveNotifications = vi.mocked(useArchiveNotifications);
const mockUseNotificationRealtimeBridge = vi.mocked(useNotificationRealtimeBridge);

vi.mock("@/hooks/notifications/useNotifications", () => ({
  useNotificationFeed: vi.fn(),
  useNotificationUnreadSummary: vi.fn(),
  useMarkNotificationsRead: vi.fn(),
  useMarkAllNotificationsRead: vi.fn(),
  useArchiveNotifications: vi.fn(),
  useNotificationRealtimeBridge: vi.fn(),
}));

describe("notifications page", () => {
  const markRead = vi.fn();
  const markAllRead = vi.fn();
  const archiveNotifications = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    cleanup();
    markRead.mockReset();
    markAllRead.mockReset();
    archiveNotifications.mockReset();
    useUserStore.setState({
      token: "test-token",
      user: {
        id: 1,
        firstName: "Amina",
        lastName: "Rahman",
        email: "amina@example.com",
        supabaseUserId: "supabase_1",
        ethereumAddress: "0x1111222233334444555566667777888899990000",
      },
    });

    mockUseNotificationRealtimeBridge.mockImplementation(() => undefined);
    mockUseNotificationUnreadSummary.mockReturnValue({
      data: {
        unreadCount: 2,
        criticalCount: 1,
        highCount: 1,
      },
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useNotificationUnreadSummary>);
    mockUseNotificationFeed.mockReturnValue({
      data: {
        items: [
          {
            id: "notif_1",
            audience: "customer",
            category: "money_movement",
            priority: "high",
            title: "Withdrawal review required",
            summary: "Your withdrawal request moved into review.",
            body: "A managed control flagged the request for operator review.",
            sourceType: "audit_event",
            sourceId: "audit_1",
            readAt: null,
            archivedAt: null,
            createdAt: "2026-04-22T10:00:00.000Z",
            updatedAt: "2026-04-22T10:00:00.000Z",
            eventCreatedAt: "2026-04-22T10:00:00.000Z",
            deepLink: {
              label: "Open transactions",
              webPath: "/transactions",
              adminPath: null,
              mobileRoute: "MainTabs",
              mobileParams: {
                screen: "Transactions",
              },
            },
            metadata: null,
          },
          {
            id: "notif_2",
            audience: "customer",
            category: "security",
            priority: "critical",
            title: "Password rotated",
            summary: "Your password was changed.",
            body: null,
            sourceType: "audit_event",
            sourceId: "audit_2",
            readAt: "2026-04-22T11:00:00.000Z",
            archivedAt: null,
            createdAt: "2026-04-21T10:00:00.000Z",
            updatedAt: "2026-04-22T11:00:00.000Z",
            eventCreatedAt: "2026-04-21T10:00:00.000Z",
            deepLink: {
              label: "Open profile",
              webPath: "/profile",
              adminPath: null,
              mobileRoute: "Profile",
              mobileParams: null,
            },
            metadata: null,
          },
        ],
        unreadCount: 2,
        limit: 80,
      },
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useNotificationFeed>);
    mockUseMarkNotificationsRead.mockReturnValue({
      mutateAsync: markRead,
      isPending: false,
    } as ReturnType<typeof useMarkNotificationsRead>);
    mockUseMarkAllNotificationsRead.mockReturnValue({
      mutateAsync: markAllRead,
      isPending: false,
    } as ReturnType<typeof useMarkAllNotificationsRead>);
    mockUseArchiveNotifications.mockReturnValue({
      mutateAsync: archiveNotifications,
      isPending: false,
    } as ReturnType<typeof useArchiveNotifications>);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the grouped inbox and triggers mark-read/archive actions", async () => {
    const user = userEvent.setup();

    renderWithRouter(<Notifications />);

    expect(
      screen.getByRole("heading", { name: "Notifications" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Unread").length).toBeGreaterThan(0);
    expect(screen.getByText("Withdrawal review required")).toBeInTheDocument();
    expect(screen.getByText("Password rotated")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Mark read" }));
    expect(markRead).toHaveBeenCalledWith(["notif_1"]);

    const archiveButtons = screen.getAllByRole("button", { name: /Archive/i });
    await user.click(archiveButtons[0]);
    expect(archiveNotifications).toHaveBeenCalledWith(["notif_1"]);
  });

  it("opens the bell drawer preview and shows unread state", async () => {
    const user = userEvent.setup();

    renderWithRouter(<CustomerNotificationBell />);

    await user.click(screen.getByRole("button", { name: /2 unread/i }));

    expect(await screen.findByText("Withdrawal review required")).toBeInTheDocument();
    expect(screen.getAllByText("2 unread").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Mark all read" })).toBeInTheDocument();
  });
});
