import { useMemo, useState } from "react";
import { Bell, ChevronRight, CircleAlert, Loader2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import type { NotificationFeedItem } from "@stealth-trails-bank/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationsRead,
  useNotificationFeed,
  useNotificationRealtimeBridge,
  useNotificationUnreadSummary,
} from "@/hooks/notifications/useNotifications";

function formatNotificationTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function priorityTone(priority: NotificationFeedItem["priority"]) {
  if (priority === "critical") {
    return "destructive";
  }

  if (priority === "high") {
    return "secondary";
  }

  return "outline";
}

export function CustomerNotificationBell() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  useNotificationRealtimeBridge();

  const unreadSummaryQuery = useNotificationUnreadSummary();
  const previewQuery = useNotificationFeed({ limit: 6 });
  const markReadMutation = useMarkNotificationsRead();
  const markAllReadMutation = useMarkAllNotificationsRead();

  const unreadCount = unreadSummaryQuery.data?.unreadCount ?? 0;
  const items = useMemo(() => previewQuery.data?.items ?? [], [previewQuery.data?.items]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="stb-data-chip border-white/12 bg-white/6 text-white transition hover:bg-white/12"
        >
          <span className="relative inline-flex items-center">
            <Bell className="h-4 w-4 text-white/84" />
            {unreadCount > 0 ? (
              <span className="absolute -right-2 -top-2 inline-flex min-w-5 items-center justify-center rounded-full bg-emerald-300 px-1.5 text-[10px] font-bold text-slate-950">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            ) : null}
          </span>
          <span>{unreadCount > 0 ? `${unreadCount} unread` : "Notifications"}</span>
        </button>
      </SheetTrigger>
      <SheetContent className="w-full border-l-slate-200 bg-[linear-gradient(180deg,#fbf9f3_0%,#ffffff_24%,#f5f8fb_100%)] sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Notifications</SheetTitle>
          <SheetDescription>
            Persistent activity across security, money movement, yield, vaults, and loans.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 flex items-center justify-between gap-3">
          <Badge variant="outline" className="border-slate-200 bg-white/80">
            {unreadCount} unread
          </Badge>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                void markAllReadMutation.mutateAsync();
              }}
              disabled={unreadCount === 0 || markAllReadMutation.isPending}
            >
              Mark all read
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setOpen(false);
                navigate("/notifications");
              }}
            >
              Open inbox
            </Button>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {previewQuery.isLoading ? (
            <div className="flex items-center gap-2 rounded-[1.5rem] border border-slate-200 bg-white/80 px-4 py-6 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading notifications
            </div>
          ) : null}

          {previewQuery.isError ? (
            <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-700">
              Failed to load notifications.
            </div>
          ) : null}

          {!previewQuery.isLoading && !previewQuery.isError && items.length === 0 ? (
            <div className="rounded-[1.5rem] border border-slate-200 bg-white/80 px-4 py-6 text-sm text-slate-600">
              No notifications yet.
            </div>
          ) : null}

          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className="w-full rounded-[1.6rem] border border-slate-200 bg-white/92 p-4 text-left shadow-[0_18px_40px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_46px_rgba(15,23,42,0.1)]"
              onClick={() => {
                if (!item.readAt) {
                  void markReadMutation.mutateAsync([item.id]);
                }

                setOpen(false);
                navigate(item.deepLink?.webPath ?? "/notifications");
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {!item.readAt ? (
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    ) : null}
                    <p className="text-sm font-semibold text-slate-950">{item.title}</p>
                  </div>
                  <p className="text-sm text-slate-600">{item.summary}</p>
                </div>
                <Badge variant={priorityTone(item.priority)}>{item.priority}</Badge>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
                <span>{formatNotificationTime(item.eventCreatedAt)}</span>
                <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                  {item.deepLink?.label ?? "View"}
                  <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-slate-950 px-4 py-4 text-sm text-white/76">
          <div className="flex items-center gap-2">
            <CircleAlert className="h-4 w-4 text-emerald-300" />
            Live unread counts update as workflow state changes.
          </div>
          <Link to="/notifications" className="mt-3 inline-flex items-center gap-1 font-semibold text-emerald-300">
            Go to the full inbox
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
