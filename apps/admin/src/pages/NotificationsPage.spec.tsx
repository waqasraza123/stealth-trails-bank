import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { NotificationsPage } from "./NotificationsPage";
import { AdminI18nProvider } from "@/i18n/provider";
import { OperatorNotificationBell } from "@/components/console/OperatorNotificationBell";
import {
  useArchiveOperatorNotifications,
  useMarkAllOperatorNotificationsRead,
  useMarkOperatorNotificationsRead,
  useOperatorNotificationFeed,
  useOperatorNotificationRealtimeBridge,
  useOperatorNotificationUnreadSummary,
} from "@/hooks/use-operator-notifications";
import { useConfiguredSessionGuard } from "./shared";

const mockUseOperatorNotificationFeed = vi.mocked(useOperatorNotificationFeed);
const mockUseOperatorNotificationUnreadSummary = vi.mocked(
  useOperatorNotificationUnreadSummary,
);
const mockUseMarkOperatorNotificationsRead = vi.mocked(
  useMarkOperatorNotificationsRead,
);
const mockUseMarkAllOperatorNotificationsRead = vi.mocked(
  useMarkAllOperatorNotificationsRead,
);
const mockUseArchiveOperatorNotifications = vi.mocked(
  useArchiveOperatorNotifications,
);
const mockUseOperatorNotificationRealtimeBridge = vi.mocked(
  useOperatorNotificationRealtimeBridge,
);
const mockUseConfiguredSessionGuard = vi.mocked(useConfiguredSessionGuard);

vi.mock("@/hooks/use-operator-notifications", () => ({
  useOperatorNotificationFeed: vi.fn(),
  useOperatorNotificationUnreadSummary: vi.fn(),
  useMarkOperatorNotificationsRead: vi.fn(),
  useMarkAllOperatorNotificationsRead: vi.fn(),
  useArchiveOperatorNotifications: vi.fn(),
  useOperatorNotificationRealtimeBridge: vi.fn(),
}));

vi.mock("./shared", async () => {
  const actual = await vi.importActual<typeof import("./shared")>("./shared");

  return {
    ...actual,
    useConfiguredSessionGuard: vi.fn(),
  };
});

function renderAdmin(element: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AdminI18nProvider>
        <MemoryRouter>{element}</MemoryRouter>
      </AdminI18nProvider>
    </QueryClientProvider>,
  );
}

describe("NotificationsPage", () => {
  const markRead = vi.fn();
  const markAllRead = vi.fn();
  const archiveNotifications = vi.fn();

  beforeEach(() => {
    cleanup();
    markRead.mockReset();
    markAllRead.mockReset();
    archiveNotifications.mockReset();

    mockUseConfiguredSessionGuard.mockReturnValue({
      session: {
        baseUrl: "http://localhost:9001",
        accessToken: "test-token",
      },
      fallback: null,
    } as ReturnType<typeof useConfiguredSessionGuard>);
    mockUseOperatorNotificationRealtimeBridge.mockImplementation(() => undefined);
    mockUseOperatorNotificationUnreadSummary.mockReturnValue({
      data: {
        unreadCount: 4,
        criticalCount: 1,
        highCount: 2,
      },
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useOperatorNotificationUnreadSummary>);
    mockUseOperatorNotificationFeed.mockReturnValue({
      data: {
        items: [
          {
            id: "operator_notif_1",
            audience: "operator",
            category: "incident",
            priority: "critical",
            title: "Platform alert opened",
            summary: "A critical alert was routed to operator review.",
            body: null,
            sourceType: "platform_alert",
            sourceId: "alert_1",
            readAt: null,
            archivedAt: null,
            createdAt: "2026-04-22T09:00:00.000Z",
            updatedAt: "2026-04-22T09:00:00.000Z",
            eventCreatedAt: "2026-04-22T09:00:00.000Z",
            deepLink: {
              label: "Open alert",
              webPath: null,
              adminPath: "/alerts?alert=alert_1",
              mobileRoute: null,
              mobileParams: null,
            },
            metadata: null,
          },
        ],
        unreadCount: 4,
        limit: 80,
      },
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useOperatorNotificationFeed>);
    mockUseMarkOperatorNotificationsRead.mockReturnValue({
      mutateAsync: markRead,
      isPending: false,
    } as ReturnType<typeof useMarkOperatorNotificationsRead>);
    mockUseMarkAllOperatorNotificationsRead.mockReturnValue({
      mutateAsync: markAllRead,
      isPending: false,
    } as ReturnType<typeof useMarkAllOperatorNotificationsRead>);
    mockUseArchiveOperatorNotifications.mockReturnValue({
      mutateAsync: archiveNotifications,
      isPending: false,
    } as ReturnType<typeof useArchiveOperatorNotifications>);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the operator inbox and triggers mark-read/archive actions", async () => {
    const user = userEvent.setup();

    renderAdmin(<NotificationsPage />);

    expect(
      screen.getByRole("heading", { name: "Operator notifications" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Platform alert opened")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Mark read" }));
    expect(markRead).toHaveBeenCalledWith(["operator_notif_1"]);

    await user.click(screen.getByRole("button", { name: /Archive/i }));
    expect(archiveNotifications).toHaveBeenCalledWith(["operator_notif_1"]);
  });

  it("renders the operator bell with unread state", () => {
    renderAdmin(<OperatorNotificationBell />);

    expect(screen.getByRole("link", { name: /4 unread/i })).toBeInTheDocument();
  });
});
