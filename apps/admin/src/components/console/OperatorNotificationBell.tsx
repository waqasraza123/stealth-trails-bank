import { Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { useOperatorNotificationRealtimeBridge, useOperatorNotificationUnreadSummary } from "@/hooks/use-operator-notifications";

export function OperatorNotificationBell() {
  useOperatorNotificationRealtimeBridge();
  const unreadSummaryQuery = useOperatorNotificationUnreadSummary();
  const unreadCount = unreadSummaryQuery.data?.unreadCount ?? 0;

  return (
    <Link to="/notifications" className="admin-notification-link">
      <span className="admin-notification-link__icon">
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="admin-notification-link__badge">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </span>
      <span>{unreadCount > 0 ? `${unreadCount} unread` : "Notifications"}</span>
    </Link>
  );
}
