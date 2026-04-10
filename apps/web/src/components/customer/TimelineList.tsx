import { formatDateLabel } from "@/lib/customer-finance";
import { useLocale } from "@/i18n/use-locale";
import type { TimelineEvent } from "@stealth-trails-bank/ui-foundation";

type TimelineListProps = {
  events: TimelineEvent[];
  emptyLabel?: string;
};

export function TimelineList({ events, emptyLabel }: TimelineListProps) {
  const { locale } = useLocale();

  if (events.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        {emptyLabel ?? (locale === "ar" ? "لا توجد أحداث بعد." : "No events yet.")}
      </p>
    );
  }

  return (
    <div className="stb-timeline" role="list">
      {events.map((event) => (
        <div
          key={event.id}
          className="stb-timeline-item"
          data-tone={event.tone ?? "neutral"}
          role="listitem"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-900">{event.label}</p>
              {event.description ? (
                <p className="text-sm leading-6 text-slate-600">{event.description}</p>
              ) : null}
            </div>
            {event.timestamp ? (
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                {formatDateLabel(event.timestamp, locale)}
              </p>
            ) : null}
          </div>
          {event.metadata?.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {event.metadata.map((item) => (
                <div
                  key={`${event.id}-${item.label}`}
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                >
                  <span className="mr-1 text-slate-500">{item.label}:</span>
                  <span className="stb-ref">{item.value}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
