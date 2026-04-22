CREATE TYPE "NotificationAudience" AS ENUM ('customer', 'operator');
CREATE TYPE "NotificationCategory" AS ENUM ('security', 'money_movement', 'yield', 'vault', 'loans', 'account', 'governance', 'operations', 'incident', 'product');
CREATE TYPE "NotificationPriority" AS ENUM ('critical', 'high', 'normal', 'low');
CREATE TYPE "NotificationChannel" AS ENUM ('in_app', 'email', 'push');
CREATE TYPE "NotificationSourceType" AS ENUM ('audit_event', 'platform_alert', 'loan_event', 'system_notice');

CREATE TABLE "NotificationEvent" (
    "id" TEXT NOT NULL,
    "sourceType" "NotificationSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "audience" "NotificationAudience" NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'normal',
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "body" TEXT,
    "deepLink" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sourceCreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "platformAlertId" TEXT,

    CONSTRAINT "NotificationEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationFeedItem" (
    "id" TEXT NOT NULL,
    "notificationEventId" TEXT NOT NULL,
    "audience" "NotificationAudience" NOT NULL,
    "recipientKey" TEXT NOT NULL,
    "customerId" TEXT,
    "operatorId" TEXT,
    "readAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationFeedItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "audience" "NotificationAudience" NOT NULL,
    "recipientKey" TEXT NOT NULL,
    "customerId" TEXT,
    "operatorId" TEXT,
    "category" "NotificationCategory" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "mandatory" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationDeliveryCursor" (
    "id" TEXT NOT NULL,
    "sourceType" "NotificationSourceType" NOT NULL,
    "lastSourceId" TEXT,
    "lastCreatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationDeliveryCursor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationEvent_sourceType_sourceId_audience_key" ON "NotificationEvent"("sourceType", "sourceId", "audience");
CREATE INDEX "NotificationEvent_audience_sourceCreatedAt_idx" ON "NotificationEvent"("audience", "sourceCreatedAt");
CREATE INDEX "NotificationEvent_category_priority_sourceCreatedAt_idx" ON "NotificationEvent"("category", "priority", "sourceCreatedAt");
CREATE INDEX "NotificationEvent_platformAlertId_sourceCreatedAt_idx" ON "NotificationEvent"("platformAlertId", "sourceCreatedAt");

CREATE UNIQUE INDEX "NotificationFeedItem_notificationEventId_recipientKey_key" ON "NotificationFeedItem"("notificationEventId", "recipientKey");
CREATE INDEX "NotificationFeedItem_audience_recipientKey_archivedAt_createdAt_idx" ON "NotificationFeedItem"("audience", "recipientKey", "archivedAt", "createdAt");
CREATE INDEX "NotificationFeedItem_customerId_readAt_archivedAt_createdAt_idx" ON "NotificationFeedItem"("customerId", "readAt", "archivedAt", "createdAt");
CREATE INDEX "NotificationFeedItem_operatorId_readAt_archivedAt_createdAt_idx" ON "NotificationFeedItem"("operatorId", "readAt", "archivedAt", "createdAt");

CREATE UNIQUE INDEX "NotificationPreference_audience_recipientKey_category_channel_key" ON "NotificationPreference"("audience", "recipientKey", "category", "channel");
CREATE INDEX "NotificationPreference_recipientKey_category_channel_idx" ON "NotificationPreference"("recipientKey", "category", "channel");
CREATE INDEX "NotificationPreference_customerId_category_channel_idx" ON "NotificationPreference"("customerId", "category", "channel");
CREATE INDEX "NotificationPreference_operatorId_category_channel_idx" ON "NotificationPreference"("operatorId", "category", "channel");

CREATE UNIQUE INDEX "NotificationDeliveryCursor_sourceType_key" ON "NotificationDeliveryCursor"("sourceType");

ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_platformAlertId_fkey" FOREIGN KEY ("platformAlertId") REFERENCES "PlatformAlert"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NotificationFeedItem" ADD CONSTRAINT "NotificationFeedItem_notificationEventId_fkey" FOREIGN KEY ("notificationEventId") REFERENCES "NotificationEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationFeedItem" ADD CONSTRAINT "NotificationFeedItem_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NotificationFeedItem" ADD CONSTRAINT "NotificationFeedItem_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE SET NULL ON UPDATE CASCADE;
