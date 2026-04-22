import type {
  NotificationAudience,
  NotificationCategory,
  NotificationChannel,
  NotificationPreferenceMatrix,
} from "@stealth-trails-bank/types";

type PreferenceRow = {
  category: NotificationCategory;
  channel: NotificationChannel;
  enabled: boolean;
  mandatory: boolean;
  updatedAt: Date;
};

type CustomerLegacyEmailPreferences = {
  depositEmails: boolean;
  withdrawalEmails: boolean;
  loanEmails: boolean;
  productUpdateEmails: boolean;
};

export const notificationCategories: NotificationCategory[] = [
  "security",
  "money_movement",
  "yield",
  "vault",
  "loans",
  "account",
  "governance",
  "operations",
  "incident",
  "product",
];

export const notificationChannels: NotificationChannel[] = [
  "in_app",
  "email",
  "push",
];

export function buildNotificationRecipientKey(
  audience: NotificationAudience,
  recipientId: string,
): string {
  return `${audience}:${recipientId}`;
}

export function isMandatoryNotificationPreference(
  audience: NotificationAudience,
  category: NotificationCategory,
  channel: NotificationChannel,
): boolean {
  if (audience === "customer") {
    return (
      category === "security" && (channel === "in_app" || channel === "email")
    );
  }

  return (
    (category === "operations" || category === "incident") &&
    channel === "in_app"
  );
}

function buildDefaultEnabledValue(
  audience: NotificationAudience,
  category: NotificationCategory,
  channel: NotificationChannel,
  legacyEmailPreferences?: CustomerLegacyEmailPreferences | null,
): boolean {
  if (isMandatoryNotificationPreference(audience, category, channel)) {
    return true;
  }

  if (channel === "push") {
    return false;
  }

  if (audience === "operator") {
    return channel === "in_app";
  }

  if (channel === "in_app") {
    return true;
  }

  if (channel === "email") {
    switch (category) {
      case "money_movement":
        return (
          legacyEmailPreferences?.depositEmails === true ||
          legacyEmailPreferences?.withdrawalEmails === true
        );
      case "loans":
        return legacyEmailPreferences?.loanEmails ?? true;
      case "product":
        return legacyEmailPreferences?.productUpdateEmails ?? false;
      case "security":
        return true;
      case "vault":
      case "yield":
      case "account":
        return true;
      default:
        return false;
    }
  }

  return true;
}

export function buildNotificationPreferenceMatrix(args: {
  audience: NotificationAudience;
  rows?: PreferenceRow[];
  legacyEmailPreferences?: CustomerLegacyEmailPreferences | null;
}): NotificationPreferenceMatrix {
  const latestUpdatedAt =
    args.rows && args.rows.length > 0
      ? args.rows
          .map((row) => row.updatedAt.getTime())
          .sort((left, right) => right - left)[0]
      : null;

  return {
    audience: args.audience,
    updatedAt: latestUpdatedAt ? new Date(latestUpdatedAt).toISOString() : null,
    entries: notificationCategories.map((category) => ({
      category,
      channels: notificationChannels.map((channel) => {
        const row = args.rows?.find(
          (candidate) =>
            candidate.category === category && candidate.channel === channel,
        );
        const mandatory = isMandatoryNotificationPreference(
          args.audience,
          category,
          channel,
        );

        return {
          channel,
          enabled:
            row?.enabled ??
            buildDefaultEnabledValue(
              args.audience,
              category,
              channel,
              args.legacyEmailPreferences,
            ),
          mandatory: row?.mandatory ?? mandatory,
        };
      }),
    })),
  };
}

export function normalizeNotificationPreferenceMatrix(
  matrix: NotificationPreferenceMatrix,
  audience: NotificationAudience,
): NotificationPreferenceMatrix {
  return buildNotificationPreferenceMatrix({
    audience,
    rows: matrix.entries.flatMap((entry: NotificationPreferenceMatrix["entries"][number]) =>
      entry.channels.map((channel: NotificationPreferenceMatrix["entries"][number]["channels"][number]) => ({
        category: entry.category,
        channel: channel.channel,
        enabled: channel.enabled,
        mandatory: channel.mandatory,
        updatedAt: new Date(),
      })),
    ),
  });
}
