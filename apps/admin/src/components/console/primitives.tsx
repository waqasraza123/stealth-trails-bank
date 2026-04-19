import { ReactNode } from "react";
import type { TimelineEvent } from "@stealth-trails-bank/ui-foundation";
import {
  AdminReveal,
  AdminStagger,
  AdminStaggerItem
} from "@/components/motion/primitives";
import { formatDateTime } from "@/lib/format";

type Tone = "neutral" | "positive" | "warning" | "critical" | "technical";

export function SectionPanel({
  title,
  description,
  children,
  action
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <AdminReveal className="admin-panel">
      <div className="admin-panel-header">
        <div>
          <h2>{title}</h2>
          {description ? <p className="admin-copy">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </AdminReveal>
  );
}

export function MetricCard({
  label,
  value,
  detail
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <AdminReveal className="admin-metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </AdminReveal>
  );
}

export function AdminStatusBadge({
  label,
  tone = "neutral"
}: {
  label: string;
  tone?: Tone;
}) {
  return (
    <span className="admin-status-badge" data-tone={tone}>
      {label}
    </span>
  );
}

export function ListCard({
  title,
  children
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <AdminReveal className="admin-list-card">
      <h3>{title}</h3>
      {children}
    </AdminReveal>
  );
}

export function EmptyState({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="admin-empty-state" role="status">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

export function LoadingState({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="admin-empty-state admin-state-card" aria-live="polite" role="status">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

export function ErrorState({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <div
      className="admin-empty-state admin-state-card admin-state-card--critical"
      aria-live="assertive"
      role="alert"
    >
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

export function InlineNotice({
  title,
  description,
  tone = "neutral"
}: {
  title: string;
  description: string;
  tone?: Tone;
}) {
  return (
    <div className="admin-inline-notice" data-tone={tone} role="status">
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

export function DetailList({
  items
}: {
  items: Array<{
    label: string;
    value: ReactNode;
    mono?: boolean;
  }>;
}) {
  return (
    <div className="admin-detail-list">
      {items.map((item) => (
        <div key={item.label} className="admin-detail-item">
          <span>{item.label}</span>
          <strong className={item.mono ? "admin-ref" : undefined}>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

export function TimelinePanel({
  title,
  description,
  events,
  emptyState
}: {
  title: string;
  description: string;
  events: TimelineEvent[];
  emptyState: {
    title: string;
    description: string;
  };
}) {
  return (
    <div className="admin-list-card">
      <h3>{title}</h3>
      <p className="admin-copy">{description}</p>
      {events.length === 0 ? (
        <EmptyState title={emptyState.title} description={emptyState.description} />
      ) : (
        <AdminStagger className="admin-timeline" role="list">
          {events.map((event) => (
            <AdminStaggerItem key={event.id}>
              <div
                className="admin-timeline-item"
                data-tone={event.tone ?? "neutral"}
                role="listitem"
              >
                <div className="admin-timeline-row">
                  <div>
                    <strong>{event.label}</strong>
                    {event.description ? <p>{event.description}</p> : null}
                  </div>
                  {event.timestamp ? (
                    <span className="admin-timeline-time">
                      {formatDateTime(event.timestamp)}
                    </span>
                  ) : null}
                </div>
                {event.metadata?.length ? (
                  <div className="admin-timeline-metadata">
                    {event.metadata.map((item) => (
                      <span key={`${event.id}-${item.label}`} className="admin-meta-chip">
                        <span>{item.label}</span>
                        <strong className="admin-ref">{item.value}</strong>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </AdminStaggerItem>
          ))}
        </AdminStagger>
      )}
    </div>
  );
}

export function WorkspaceLayout({
  sidebar,
  main,
  rail
}: {
  sidebar: ReactNode;
  main: ReactNode;
  rail: ReactNode;
}) {
  return (
    <div className="admin-workspace-layout">
      <div className="admin-workspace-column">{sidebar}</div>
      <div className="admin-workspace-column">{main}</div>
      <div className="admin-workspace-column">{rail}</div>
    </div>
  );
}

export function ActionRail({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <AdminReveal className="admin-action-rail">
      <div>
        <h3>{title}</h3>
        <p className="admin-copy">{description}</p>
      </div>
      {children}
    </AdminReveal>
  );
}
