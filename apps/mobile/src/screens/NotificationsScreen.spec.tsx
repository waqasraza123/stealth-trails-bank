import { fireEvent, waitFor } from "@testing-library/react-native";
import { NotificationsScreen } from "./NotificationsScreen";
import { renderMobile } from "../test/test-utils";

const mockNavigate = jest.fn();

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
}));

jest.mock("../hooks/use-notifications", () => ({
  useNotificationsQuery: jest.fn(),
  useNotificationUnreadSummaryQuery: jest.fn(),
  useMarkNotificationsReadMutation: jest.fn(),
  useMarkAllNotificationsReadMutation: jest.fn(),
  useArchiveNotificationsMutation: jest.fn(),
}));

const {
  useNotificationsQuery,
  useNotificationUnreadSummaryQuery,
  useMarkNotificationsReadMutation,
  useMarkAllNotificationsReadMutation,
  useArchiveNotificationsMutation,
} = jest.requireMock("../hooks/use-notifications") as {
  useNotificationsQuery: jest.Mock;
  useNotificationUnreadSummaryQuery: jest.Mock;
  useMarkNotificationsReadMutation: jest.Mock;
  useMarkAllNotificationsReadMutation: jest.Mock;
  useArchiveNotificationsMutation: jest.Mock;
};

describe("NotificationsScreen", () => {
  const markRead = jest.fn();
  const markAllRead = jest.fn();
  const archiveNotifications = jest.fn();

  beforeEach(() => {
    mockNavigate.mockReset();
    markRead.mockReset();
    markAllRead.mockReset();
    archiveNotifications.mockReset();

    useNotificationUnreadSummaryQuery.mockReturnValue({
      data: {
        unreadCount: 3,
        criticalCount: 1,
        highCount: 1,
      },
      isLoading: false,
      isError: false,
    });
    useNotificationsQuery.mockReturnValue({
      data: {
        items: [
          {
            id: "mobile_notif_1",
            audience: "customer",
            category: "loans",
            priority: "high",
            title: "Loan review required",
            summary: "Your application needs additional review.",
            body: "An operator has been asked to review the application.",
            sourceType: "loan_event",
            sourceId: "loan_event_1",
            readAt: null,
            archivedAt: null,
            createdAt: "2026-04-22T10:00:00.000Z",
            updatedAt: "2026-04-22T10:00:00.000Z",
            eventCreatedAt: "2026-04-22T10:00:00.000Z",
            deepLink: {
              label: "Open",
              webPath: "/loans",
              adminPath: null,
              mobileRoute: "Loans",
              mobileParams: null,
            },
            metadata: null,
          },
        ],
        unreadCount: 3,
        limit: 80,
      },
      isLoading: false,
      isError: false,
    });
    useMarkNotificationsReadMutation.mockReturnValue({
      mutateAsync: markRead,
      isPending: false,
    });
    useMarkAllNotificationsReadMutation.mockReturnValue({
      mutateAsync: markAllRead,
      isPending: false,
    });
    useArchiveNotificationsMutation.mockReturnValue({
      mutateAsync: archiveNotifications,
      isPending: false,
    });
  });

  it("renders the mobile inbox and triggers mark-read/archive/deep-link actions", async () => {
    const screen = renderMobile(<NotificationsScreen />, {
      user: {
        id: 1,
        email: "user@example.com",
        firstName: "Mobile",
        lastName: "Customer",
        supabaseUserId: "supabase-user",
        ethereumAddress: "0x1234567890123456789012345678901234567890",
      },
      token: "test-token",
    });

    expect(screen.getByText("Notifications")).toBeTruthy();
    expect(screen.getByText("Loan review required")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();

    fireEvent.press(screen.getByText("Mark all read"));
    expect(markAllRead).toHaveBeenCalled();

    fireEvent.press(screen.getByText("Mark read"));
    await waitFor(() => {
      expect(markRead).toHaveBeenCalledWith(["mobile_notif_1"]);
    });

    fireEvent.press(screen.getByText("Archive"));
    expect(archiveNotifications).toHaveBeenCalledWith(["mobile_notif_1"]);

    fireEvent.press(screen.getByText("Open"));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("Loans");
    });
  });
});
