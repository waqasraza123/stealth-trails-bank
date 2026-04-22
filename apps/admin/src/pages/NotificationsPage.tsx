import { useEffect, useMemo, useState } from "react";
import type {
  NotificationCategory,
  NotificationFeedItem,
  NotificationPreferenceMatrix
} from "@stealth-trails-bank/types";
import { Archive, ArrowRight, BellRing, Inbox } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  AdminStatusBadge,
  EmptyState,
  ErrorState,
  LoadingState,
  SectionPanel
} from "@/components/console/primitives";
import {
  useArchiveOperatorNotifications,
  useMarkAllOperatorNotificationsRead,
  useMarkOperatorNotificationsRead,
  useOperatorNotificationFeed,
  useOperatorNotificationPreferences,
  useOperatorNotificationRealtimeBridge,
  useOperatorNotificationUnreadSummary,
  useUpdateOperatorNotificationPreferences
} from "@/hooks/use-operator-notifications";
import { formatDateTime, toTitleCase } from "@/lib/format";
import { mapStatusToTone, useConfiguredSessionGuard } from "./shared";

const categories: Array<{ label: string; value: NotificationCategory | null }> = [
  { label: "All", value: null },
  { label: "Operations", value: "operations" },
  { label: "Incident", value: "incident" },
  { label: "Money Movement", value: "money_movement" },
  { label: "Governance", value: "governance" },
  { label: "Vault", value: "vault" },
  { label: "Yield", value: "yield" },
  { label: "Loans", value: "loans" },
  { label: "Security", value: "security" },
];

function groupLabel(item: NotificationFeedItem) {
  if (!item.readAt) {
    return "Unread";
  }

  const ageMs = Date.now() - Date.parse(item.eventCreatedAt);

  if (ageMs < 24 * 60 * 60 * 1000) {
    return "Today";
  }

  if (ageMs < 7 * 24 * 60 * 60 * 1000) {
    return "Earlier this week";
  }

  return "Earlier";
}

function resolveDestination(item: NotificationFeedItem) {
  return item.deepLink?.adminPath ?? "/operations";
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const { session, fallback } = useConfiguredSessionGuard();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selectedCategory, setSelectedCategory] =
    useState<NotificationCategory | null>(null);
  useOperatorNotificationRealtimeBridge();

  const notificationsQuery = useOperatorNotificationFeed({
    limit: 80,
    unreadOnly,
    category: selectedCategory ?? undefined
  });
  const unreadSummaryQuery = useOperatorNotificationUnreadSummary();
  const preferencesQuery = useOperatorNotificationPreferences();
  const updatePreferencesMutation = useUpdateOperatorNotificationPreferences();
  const markReadMutation = useMarkOperatorNotificationsRead();
  const markAllReadMutation = useMarkAllOperatorNotificationsRead();
  const archiveMutation = useArchiveOperatorNotifications();
  const [preferenceDraft, setPreferenceDraft] =
    useState<NotificationPreferenceMatrix | null>(null);

  useEffect(() => {
    setPreferenceDraft(preferencesQuery.data ?? null);
  }, [preferencesQuery.data]);

  const groupedItems = useMemo(() => {
    const buckets = new Map<string, NotificationFeedItem[]>();

    for (const item of notificationsQuery.data?.items ?? []) {
      const label = groupLabel(item);
      const group = buckets.get(label) ?? [];
      group.push(item);
      buckets.set(label, group);
    }

    return Array.from(buckets.entries());
  }, [notificationsQuery.data?.items]);

  if (fallback) {
    return fallback;
  }

  if (!session && !fallback) {
    return null;
  }

  if (notificationsQuery.isLoading && !notificationsQuery.data) {
    return (
      <LoadingState
        title="Loading operator notifications"
        description="Review, incident, and operational notifications are loading."
      />
    );
  }

  if (notificationsQuery.isError) {
    return (
      <ErrorState
        title="Operator notifications unavailable"
        description="The notification workspace could not load its latest feed."
      />
    );
  }

  return (
    <div className="admin-page-grid">
      <SectionPanel
        title="Operator notifications"
        description="Persistent routing visibility for queues, incidents, and governed work."
        action={
          <div className="admin-inline-actions">
            <button
              type="button"
              className={unreadOnly ? "admin-filter-chip active" : "admin-filter-chip"}
              onClick={() => setUnreadOnly((current) => !current)}
            >
              {unreadOnly ? "Unread only" : "All activity"}
            </button>
            <button
              type="button"
              className="admin-filter-chip"
              onClick={() => {
                void markAllReadMutation.mutateAsync();
              }}
              disabled={(unreadSummaryQuery.data?.unreadCount ?? 0) === 0}
            >
              Mark all read
            </button>
          </div>
        }
      >
        <div className="admin-notification-summary-grid">
          <div className="admin-summary-card">
            <span>Unread</span>
            <strong>{unreadSummaryQuery.data?.unreadCount ?? 0}</strong>
          </div>
          <div className="admin-summary-card">
            <span>Critical</span>
            <strong>{unreadSummaryQuery.data?.criticalCount ?? 0}</strong>
          </div>
          <div className="admin-summary-card">
            <span>High</span>
            <strong>{unreadSummaryQuery.data?.highCount ?? 0}</strong>
          </div>
        </div>

        <div className="admin-filter-row">
          {categories.map((category) => (
            <button
              key={category.label}
              type="button"
              className={
                selectedCategory === category.value
                  ? "admin-filter-chip active"
                  : "admin-filter-chip"
              }
              onClick={() => setSelectedCategory(category.value)}
            >
              {category.label}
            </button>
          ))}
        </div>

        {groupedItems.length === 0 ? (
          <EmptyState
            title="No notifications to show"
            description="New queue and incident events will appear here as they are projected."
          />
        ) : (
          <div className="admin-notification-groups">
            {groupedItems.map(([label, items]) => (
              <section key={label} className="admin-notification-group">
                <div className="admin-section-heading">
                  <h3>{label}</h3>
                  <span>{items.length}</span>
                </div>
                <div className="admin-list">
                  {items.map((item) => (
                    <article key={item.id} className="admin-notification-card">
                      <div className="admin-notification-card__header">
                        <div>
                          <div className="admin-notification-card__badges">
                            {!item.readAt ? (
                              <AdminStatusBadge label="Unread" tone="positive" />
                            ) : null}
                            <AdminStatusBadge
                              label={item.priority}
                              tone={mapStatusToTone(item.priority)}
                            />
                            <AdminStatusBadge
                              label={toTitleCase(item.category.replace(/_/g, " "))}
                              tone="neutral"
                            />
                          </div>
                          <h4>{item.title}</h4>
                          <p>{item.summary}</p>
                          {item.body ? <p className="admin-copy">{item.body}</p> : null}
                        </div>
                        <div className="admin-notification-card__timestamp">
                          {formatDateTime(item.eventCreatedAt)}
                        </div>
                      </div>
                      <div className="admin-notification-card__actions">
                        {!item.readAt ? (
                          <button
                            type="button"
                            className="admin-filter-chip"
                            onClick={() => {
                              void markReadMutation.mutateAsync([item.id]);
                            }}
                          >
                            Mark read
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="admin-filter-chip"
                          onClick={() => {
                            void archiveMutation.mutateAsync([item.id]);
                          }}
                        >
                          <Archive className="h-4 w-4" />
                          Archive
                        </button>
                        <button
                          type="button"
                          className="admin-primary-action"
                          onClick={() => {
                            if (!item.readAt) {
                              void markReadMutation.mutateAsync([item.id]);
                            }

                            navigate(resolveDestination(item));
                          }}
                        >
                          {item.deepLink?.label ?? "Open workspace"}
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </SectionPanel>

      <SectionPanel
        title="Routing principle"
        description="Notifications stay informational. Actual governed actions remain in their destination workspaces."
      >
        <div className="admin-two-column">
          <div className="admin-list-card">
            <h3>Why this inbox exists</h3>
            <p className="admin-copy">
              Operators need a durable history of new work, not another place to approve it.
            </p>
            <p className="admin-copy">
              Each item deep-links into queues, alerts, reconciliation, solvency, vault, or security work with context preserved.
            </p>
          </div>
          <div className="admin-list-card">
            <h3>Realtime signal</h3>
            <div className="admin-inline-notice" data-tone="technical">
              <strong className="inline-flex items-center gap-2">
                <BellRing className="h-4 w-4" />
                One websocket transport
              </strong>
              <p>
                Unread counts and newly projected items update across connected operator sessions without polling-only lag.
              </p>
            </div>
            <div className="admin-inline-notice" data-tone="neutral">
              <strong className="inline-flex items-center gap-2">
                <Inbox className="h-4 w-4" />
                Read-only control plane
              </strong>
              <p>
                The inbox tracks state. Decision rights stay in the governed execution and review pages.
              </p>
            </div>
          </div>
        </div>
      </SectionPanel>

      <SectionPanel
        title="Operator preferences"
        description="Control which supported channels deliver each operator notification category."
      >
        {!preferenceDraft ? (
          <EmptyState
            title="Preferences unavailable"
            description="Operator notification preferences could not be loaded."
          />
        ) : (
          <div className="admin-list">
            {preferenceDraft.entries.map((entry) => (
              <article key={entry.category} className="admin-notification-card">
                <div className="admin-notification-card__header">
                  <div>
                    <h4>{toTitleCase(entry.category.replace(/_/g, " "))}</h4>
                    <p>Supported delivery channels for this operator category.</p>
                  </div>
                </div>
                <div className="admin-inline-actions">
                  {entry.channels
                    .filter((channel) =>
                      preferenceDraft.supportedChannels.includes(channel.channel)
                    )
                    .map((channel) => (
                      <label
                        key={`${entry.category}-${channel.channel}`}
                        className="admin-filter-chip"
                      >
                        <input
                          type="checkbox"
                          checked={channel.enabled}
                          disabled={channel.mandatory}
                          onChange={(event) =>
                            setPreferenceDraft((current) =>
                              !current
                                ? current
                                : {
                                    ...current,
                                    entries: current.entries.map((candidate) =>
                                      candidate.category !== entry.category
                                        ? candidate
                                        : {
                                            ...candidate,
                                            channels: candidate.channels.map(
                                              (candidateChannel) =>
                                                candidateChannel.channel !==
                                                channel.channel
                                                  ? candidateChannel
                                                  : {
                                                      ...candidateChannel,
                                                      enabled:
                                                        event.target.checked
                                                    }
                                            )
                                          }
                                    )
                                  }
                            )
                          }
                        />
                        <span>{toTitleCase(channel.channel.replace(/_/g, " "))}</span>
                      </label>
                    ))}
                </div>
              </article>
            ))}
            <button
              type="button"
              className="admin-primary-action"
              onClick={() => {
                if (preferenceDraft) {
                  void updatePreferencesMutation.mutateAsync(preferenceDraft);
                }
              }}
              disabled={!preferenceDraft || updatePreferencesMutation.isPending}
            >
              {updatePreferencesMutation.isPending
                ? "Saving preferences..."
                : "Save preferences"}
            </button>
          </div>
        )}
      </SectionPanel>
    </div>
  );
}
