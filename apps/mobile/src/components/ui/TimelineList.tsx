import { View } from "react-native";
import type { TimelineEvent } from "@stealth-trails-bank/ui-foundation";
import { useLocale } from "../../i18n/use-locale";
import { formatDateLabel } from "../../lib/finance";
import { AppText } from "./AppText";
import { LtrValue } from "./LtrValue";

type TimelineListProps = {
  events: TimelineEvent[];
};

export function TimelineList({ events }: TimelineListProps) {
  const { locale, t } = useLocale();

  if (events.length === 0) {
    return (
      <AppText className="text-sm text-slate">{t("common.noData")}</AppText>
    );
  }

  return (
    <View className="gap-3">
      {events.map((event) => (
        <View
          key={event.id}
          className="rounded-2xl border border-border bg-white px-4 py-3"
        >
          <AppText className="text-sm text-ink" weight="semibold">
            {event.label}
          </AppText>
          {event.description ? (
            <AppText className="mt-1 text-sm text-slate">
              {event.description}
            </AppText>
          ) : null}
          {event.timestamp ? (
            <AppText className="mt-2 text-xs text-slate">
              {formatDateLabel(event.timestamp, locale)}
            </AppText>
          ) : null}
          {event.metadata?.length ? (
            <View className="mt-3 gap-2">
              {event.metadata.map((item) => (
                <View key={`${event.id}-${item.label}`} className="flex-row gap-2">
                  <AppText className="text-xs text-slate">{item.label}:</AppText>
                  <LtrValue value={item.value} className="text-xs text-ink" />
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}
