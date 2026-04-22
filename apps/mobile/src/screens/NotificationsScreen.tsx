import { Pressable, View } from "react-native";
import { useMemo, useState } from "react";
import type { NotificationCategory, NotificationFeedItem } from "@stealth-trails-bank/types";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AnimatedSection } from "../components/ui/AnimatedSection";
import { AppButton } from "../components/ui/AppButton";
import { AppScreen } from "../components/ui/AppScreen";
import { AppText } from "../components/ui/AppText";
import { LanguageToggle } from "../components/ui/LanguageToggle";
import {
  useArchiveNotificationsMutation,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationsReadMutation,
  useNotificationsQuery,
  useNotificationUnreadSummaryQuery,
} from "../hooks/use-notifications";
import type { RootStackParamList } from "../navigation/types";

const categories: Array<{ label: string; value: NotificationCategory | null }> = [
  { label: "All", value: null },
  { label: "Security", value: "security" },
  { label: "Money", value: "money_movement" },
  { label: "Yield", value: "yield" },
  { label: "Vault", value: "vault" },
  { label: "Loans", value: "loans" },
  { label: "Account", value: "account" },
  { label: "Product", value: "product" },
];

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

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

export function NotificationsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selectedCategory, setSelectedCategory] =
    useState<NotificationCategory | null>(null);
  const notificationsQuery = useNotificationsQuery({
    limit: 80,
    unreadOnly,
    category: selectedCategory ?? undefined,
  });
  const unreadSummaryQuery = useNotificationUnreadSummaryQuery();
  const markReadMutation = useMarkNotificationsReadMutation();
  const markAllReadMutation = useMarkAllNotificationsReadMutation();
  const archiveMutation = useArchiveNotificationsMutation();

  const groupedItems = useMemo(() => {
    const groups = new Map<string, NotificationFeedItem[]>();

    for (const item of notificationsQuery.data?.items ?? []) {
      const label = groupLabel(item);
      const bucket = groups.get(label) ?? [];
      bucket.push(item);
      groups.set(label, bucket);
    }

    return Array.from(groups.entries());
  }, [notificationsQuery.data?.items]);

  return (
    <AppScreen
      title="Notifications"
      subtitle="Persistent cross-screen awareness for security, money movement, yield, vaults, and loans."
      trailing={<LanguageToggle />}
    >
      <AnimatedSection delayOrder={1} variant="up">
        <View className="gap-3 rounded-[30px] border border-border bg-white/92 p-5">
          <View className="flex-row flex-wrap gap-3">
            <View className="rounded-[24px] border border-border bg-sand px-4 py-3">
              <AppText className="text-[11px] uppercase tracking-[1.3px] text-slate">
                Unread
              </AppText>
              <AppText className="mt-2 text-2xl text-ink" weight="bold">
                {unreadSummaryQuery.data?.unreadCount ?? 0}
              </AppText>
            </View>
            <View className="rounded-[24px] border border-border bg-sand px-4 py-3">
              <AppText className="text-[11px] uppercase tracking-[1.3px] text-slate">
                Critical
              </AppText>
              <AppText className="mt-2 text-2xl text-ink" weight="bold">
                {unreadSummaryQuery.data?.criticalCount ?? 0}
              </AppText>
            </View>
            <View className="rounded-[24px] border border-border bg-sand px-4 py-3">
              <AppText className="text-[11px] uppercase tracking-[1.3px] text-slate">
                High
              </AppText>
              <AppText className="mt-2 text-2xl text-ink" weight="bold">
                {unreadSummaryQuery.data?.highCount ?? 0}
              </AppText>
            </View>
          </View>
          <View className="flex-row flex-wrap gap-2">
            <AppButton
              label={unreadOnly ? "Unread only" : "All activity"}
              onPress={() => setUnreadOnly((current) => !current)}
              variant={unreadOnly ? "primary" : "secondary"}
              fullWidth={false}
            />
            <AppButton
              label="Mark all read"
              onPress={() => {
                void markAllReadMutation.mutateAsync();
              }}
              variant="secondary"
              fullWidth={false}
              disabled={(unreadSummaryQuery.data?.unreadCount ?? 0) === 0}
            />
          </View>
          <View className="flex-row flex-wrap gap-2">
            {categories.map((category) => (
              <Pressable
                key={category.label}
                className={`rounded-full border px-3 py-2 ${
                  selectedCategory === category.value
                    ? "border-ink bg-ink"
                    : "border-border bg-white"
                }`}
                onPress={() => setSelectedCategory(category.value)}
              >
                <AppText
                  className={`text-xs ${
                    selectedCategory === category.value ? "text-white" : "text-ink"
                  }`}
                  weight="semibold"
                >
                  {category.label}
                </AppText>
              </Pressable>
            ))}
          </View>
        </View>
      </AnimatedSection>

      <AnimatedSection delayOrder={2} variant="up">
        <View className="gap-4">
          {notificationsQuery.isLoading ? (
            <View className="rounded-[28px] border border-border bg-white/92 p-5">
              <AppText className="text-sm text-slate">Loading notifications...</AppText>
            </View>
          ) : null}
          {notificationsQuery.isError ? (
            <View className="rounded-[28px] border border-danger/30 bg-danger/10 p-5">
              <AppText className="text-sm text-danger">
                The notification inbox could not be loaded.
              </AppText>
            </View>
          ) : null}
          {!notificationsQuery.isLoading &&
          !notificationsQuery.isError &&
          groupedItems.length === 0 ? (
            <View className="rounded-[28px] border border-dashed border-border bg-white/92 p-6">
              <AppText className="text-base text-ink" weight="semibold">
                No notifications yet
              </AppText>
              <AppText className="mt-2 text-sm leading-6 text-slate">
                Important customer events will appear here as soon as they are projected.
              </AppText>
            </View>
          ) : null}
          {groupedItems.map(([label, items]) => (
            <View key={label} className="gap-3">
              <View className="flex-row items-center justify-between px-1">
                <AppText className="text-xs uppercase tracking-[1.4px] text-slate" weight="semibold">
                  {label}
                </AppText>
                <AppText className="text-xs text-slate">{items.length}</AppText>
              </View>
              {items.map((item) => (
                <View
                  key={item.id}
                  className={`rounded-[28px] border p-5 ${
                    item.readAt
                      ? "border-border bg-white/92"
                      : "border-sea/30 bg-white"
                  }`}
                >
                  <View className="gap-3">
                    <View className="flex-row items-start justify-between gap-3">
                      <View className="flex-1 gap-2">
                        <View className="flex-row flex-wrap gap-2">
                          {!item.readAt ? (
                            <View className="rounded-full bg-sea px-3 py-1">
                              <AppText className="text-[11px] text-ink" weight="semibold">
                                Unread
                              </AppText>
                            </View>
                          ) : null}
                          <View className="rounded-full border border-border bg-sand px-3 py-1">
                            <AppText className="text-[11px] text-ink" weight="semibold">
                              {item.priority}
                            </AppText>
                          </View>
                        </View>
                        <AppText className="text-lg text-ink" weight="bold">
                          {item.title}
                        </AppText>
                        <AppText className="text-sm leading-6 text-slate">
                          {item.summary}
                        </AppText>
                        {item.body ? (
                          <AppText className="text-sm leading-6 text-slate">
                            {item.body}
                          </AppText>
                        ) : null}
                      </View>
                      <AppText className="text-xs text-slate">
                        {formatDateLabel(item.eventCreatedAt)}
                      </AppText>
                    </View>
                    <View className="flex-row flex-wrap gap-2">
                      {!item.readAt ? (
                        <AppButton
                          label="Mark read"
                          onPress={() => {
                            void markReadMutation.mutateAsync([item.id]);
                          }}
                          variant="secondary"
                          fullWidth={false}
                        />
                      ) : null}
                      <AppButton
                        label="Archive"
                        onPress={() => {
                          void archiveMutation.mutateAsync([item.id]);
                        }}
                        variant="ghost"
                        fullWidth={false}
                      />
                      <AppButton
                        label={item.deepLink?.label ?? "Open"}
                        onPress={() => {
                          if (!item.readAt) {
                            void markReadMutation.mutateAsync([item.id]);
                          }

                          if (item.deepLink?.mobileRoute === "Loans") {
                            navigation.navigate("Loans");
                            return;
                          }

                          if (item.deepLink?.mobileRoute === "RetirementVault") {
                            navigation.navigate("RetirementVault");
                            return;
                          }

                          navigation.navigate("MainTabs");
                        }}
                        variant="primary"
                        fullWidth={false}
                      />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ))}
        </View>
      </AnimatedSection>
    </AppScreen>
  );
}
