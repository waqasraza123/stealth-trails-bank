export type JsonPrimitive = null | boolean | number | string;

export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | {
      [key: string]: JsonValue;
    };

export type NotificationAudience = "customer" | "operator";

export type NotificationCategory =
  | "security"
  | "money_movement"
  | "yield"
  | "vault"
  | "loans"
  | "account"
  | "governance"
  | "operations"
  | "incident"
  | "product";

export type NotificationPriority = "critical" | "high" | "normal" | "low";

export type NotificationChannel = "in_app" | "email" | "push";

export type NotificationChannelPreference = {
  channel: NotificationChannel;
  enabled: boolean;
  mandatory: boolean;
};

export type NotificationPreferenceEntry = {
  category: NotificationCategory;
  channels: NotificationChannelPreference[];
};

export type NotificationPreferenceMatrix = {
  audience: NotificationAudience;
  entries: NotificationPreferenceEntry[];
  updatedAt: string | null;
};

export type NotificationDeepLink = {
  label: string | null;
  webPath: string | null;
  adminPath: string | null;
  mobileRoute: string | null;
  mobileParams: JsonValue | null;
};

export type NotificationFeedItem = {
  id: string;
  audience: NotificationAudience;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  summary: string;
  body: string | null;
  sourceType: "audit_event" | "platform_alert" | "loan_event" | "system_notice";
  sourceId: string;
  readAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  eventCreatedAt: string;
  deepLink: NotificationDeepLink | null;
  metadata: JsonValue | null;
};

export type NotificationFeedResult = {
  items: NotificationFeedItem[];
  unreadCount: number;
  limit: number;
};

export type NotificationUnreadSummary = {
  unreadCount: number;
  criticalCount: number;
  highCount: number;
};
