import { useMemo, useState } from "react";
import type { NotificationCategory, NotificationFeedItem } from "@stealth-trails-bank/types";
import { Archive, Bell, ChevronRight, Filter, Inbox, Loader2 } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useArchiveNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationsRead,
  useNotificationFeed,
  useNotificationRealtimeBridge,
  useNotificationUnreadSummary,
} from "@/hooks/notifications/useNotifications";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

const categories: Array<{ label: string; value: NotificationCategory | null }> = [
  { label: "All", value: null },
  { label: "Security", value: "security" },
  { label: "Money movement", value: "money_movement" },
  { label: "Yield", value: "yield" },
  { label: "Vault", value: "vault" },
  { label: "Loans", value: "loans" },
  { label: "Account", value: "account" },
  { label: "Governance", value: "governance" },
  { label: "Operations", value: "operations" },
  { label: "Incident", value: "incident" },
  { label: "Product", value: "product" },
];

function formatNotificationTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function resolveGroupLabel(item: NotificationFeedItem) {
  if (!item.readAt) {
    return "Unread";
  }

  const now = Date.now();
  const createdAt = new Date(item.eventCreatedAt).getTime();
  const ageMs = now - createdAt;

  if (ageMs < 24 * 60 * 60 * 1000) {
    return "Today";
  }

  if (ageMs < 7 * 24 * 60 * 60 * 1000) {
    return "Earlier this week";
  }

  return "Earlier";
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

export default function Notifications() {
  const navigate = useNavigate();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selectedCategory, setSelectedCategory] =
    useState<NotificationCategory | null>(null);
  useNotificationRealtimeBridge();

  const notificationsQuery = useNotificationFeed({
    limit: 80,
    unreadOnly,
    category: selectedCategory ?? undefined,
  });
  const unreadSummaryQuery = useNotificationUnreadSummary();
  const markReadMutation = useMarkNotificationsRead();
  const markAllReadMutation = useMarkAllNotificationsRead();
  const archiveMutation = useArchiveNotifications();

  const groupedItems = useMemo(() => {
    const groups = new Map<string, NotificationFeedItem[]>();

    for (const item of notificationsQuery.data?.items ?? []) {
      const key = resolveGroupLabel(item);
      const bucket = groups.get(key) ?? [];
      bucket.push(item);
      groups.set(key, bucket);
    }

    return Array.from(groups.entries());
  }, [notificationsQuery.data?.items]);

  return (
    <Layout>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="border-slate-200 bg-white/82 shadow-[0_26px_70px_rgba(15,23,42,0.08)]">
          <CardHeader className="gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">
                <Badge variant="outline" className="w-fit border-slate-200 bg-slate-50">
                  Persistent inbox
                </Badge>
                <CardTitle className="text-2xl text-slate-950">Notifications</CardTitle>
                <p className="text-sm leading-6 text-slate-600">
                  Follow important events without losing context across pages or devices.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={unreadOnly ? "default" : "outline"}
                  onClick={() => setUnreadOnly((current) => !current)}
                >
                  <Filter className="mr-2 h-4 w-4" />
                  {unreadOnly ? "Unread only" : "All activity"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    void markAllReadMutation.mutateAsync();
                  }}
                  disabled={(unreadSummaryQuery.data?.unreadCount ?? 0) === 0}
                >
                  Mark all read
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => {
                const active = selectedCategory === category.value;

                return (
                  <button
                    key={category.label}
                    type="button"
                    className={cn(
                      "rounded-full border px-3 py-2 text-xs font-semibold transition",
                      active
                        ? "border-slate-950 bg-slate-950 text-white"
                        : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white",
                    )}
                    onClick={() => setSelectedCategory(category.value)}
                  >
                    {category.label}
                  </button>
                );
              })}
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {notificationsQuery.isLoading ? (
              <div className="flex items-center gap-2 rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading notifications
              </div>
            ) : null}

            {notificationsQuery.isError ? (
              <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-700">
                The notification inbox could not be loaded.
              </div>
            ) : null}

            {!notificationsQuery.isLoading &&
            !notificationsQuery.isError &&
            groupedItems.length === 0 ? (
              <div className="rounded-[1.6rem] border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
                <Inbox className="mx-auto h-8 w-8 text-slate-400" />
                <p className="mt-3 text-sm font-semibold text-slate-900">Nothing to show</p>
                <p className="mt-2 text-sm text-slate-600">
                  New notifications will appear here as important workflow state changes.
                </p>
              </div>
            ) : null}

            {groupedItems.map(([groupLabel, items]) => (
              <section key={groupLabel} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {groupLabel}
                  </h2>
                  <span className="text-xs text-slate-400">{items.length}</span>
                </div>
                <div className="space-y-3">
                  {items.map((item) => (
                    <article
                      key={item.id}
                      className={cn(
                        "rounded-[1.75rem] border p-4 shadow-[0_18px_44px_rgba(15,23,42,0.06)] transition",
                        !item.readAt
                          ? "border-emerald-200 bg-[linear-gradient(180deg,rgba(236,253,245,0.95),rgba(255,255,255,0.96))]"
                          : "border-slate-200 bg-white/92",
                      )}
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {!item.readAt ? (
                              <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                                Unread
                              </Badge>
                            ) : null}
                            <Badge variant={priorityTone(item.priority)}>{item.priority}</Badge>
                            <Badge variant="outline" className="border-slate-200 bg-white/70">
                              {item.category.replace(/_/g, " ")}
                            </Badge>
                          </div>
                          <div>
                            <h3 className="text-base font-semibold text-slate-950">{item.title}</h3>
                            <p className="mt-1 text-sm leading-6 text-slate-600">{item.summary}</p>
                            {item.body ? (
                              <p className="mt-2 text-sm leading-6 text-slate-500">{item.body}</p>
                            ) : null}
                          </div>
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                            {formatNotificationTime(item.eventCreatedAt)}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {!item.readAt ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                void markReadMutation.mutateAsync([item.id]);
                              }}
                            >
                              Mark read
                            </Button>
                          ) : null}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              void archiveMutation.mutateAsync([item.id]);
                            }}
                          >
                            <Archive className="mr-2 h-4 w-4" />
                            Archive
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              if (!item.readAt) {
                                void markReadMutation.mutateAsync([item.id]);
                              }

                              navigate(item.deepLink?.webPath ?? "/transactions");
                            }}
                          >
                            {item.deepLink?.label ?? "Open"}
                            <ChevronRight className="ml-2 h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-slate-200 bg-slate-950 text-white shadow-[0_26px_70px_rgba(15,23,42,0.14)]">
            <CardHeader>
              <Badge className="w-fit bg-white/10 text-white hover:bg-white/10">
                Live state
              </Badge>
              <CardTitle className="text-white">Unread summary</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-[1.2rem] border border-white/10 bg-white/6 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-white/54">Unread</p>
                <p className="mt-2 text-3xl font-semibold">
                  {unreadSummaryQuery.data?.unreadCount ?? 0}
                </p>
              </div>
              <div className="rounded-[1.2rem] border border-white/10 bg-white/6 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-white/54">Critical</p>
                <p className="mt-2 text-3xl font-semibold">
                  {unreadSummaryQuery.data?.criticalCount ?? 0}
                </p>
              </div>
              <div className="rounded-[1.2rem] border border-white/10 bg-white/6 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-white/54">High</p>
                <p className="mt-2 text-3xl font-semibold">
                  {unreadSummaryQuery.data?.highCount ?? 0}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white/86">
            <CardHeader>
              <Badge variant="outline" className="w-fit border-slate-200 bg-slate-50">
                Design rule
              </Badge>
              <CardTitle className="text-slate-950">Inbox, not interruption</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
              <p>
                Important lifecycle events stay here until you read or archive them.
              </p>
              <p>
                Short-lived toasts still belong to immediate local actions. Persistent product state belongs in the inbox.
              </p>
              <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-4 text-slate-700">
                <div className="flex items-center gap-2 font-semibold">
                  <Bell className="h-4 w-4" />
                  Deep links keep context
                </div>
                <p className="mt-2 text-sm leading-6">
                  Every item routes into the relevant workflow surface instead of asking you to search for it again.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
