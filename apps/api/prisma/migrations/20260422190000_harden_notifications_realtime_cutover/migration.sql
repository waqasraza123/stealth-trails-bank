DELETE FROM "NotificationFeedItem";
DELETE FROM "NotificationEvent";

ALTER TABLE "NotificationFeedItem"
ADD COLUMN "deliverySequence" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "NotificationRecipientState" (
    "id" TEXT NOT NULL,
    "audience" "NotificationAudience" NOT NULL,
    "recipientKey" TEXT NOT NULL,
    "customerId" TEXT,
    "operatorId" TEXT,
    "latestDeliverySequence" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationRecipientState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationSocketSession" (
    "id" TEXT NOT NULL,
    "audience" "NotificationAudience" NOT NULL,
    "recipientKey" TEXT NOT NULL,
    "customerId" TEXT,
    "operatorId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastIssuedSequence" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationSocketSession_pkey" PRIMARY KEY ("id")
);

DROP INDEX "NotificationFeedItem_audience_recipientKey_archivedAt_createdAt_idx";
CREATE UNIQUE INDEX "NotificationFeedItem_recipientKey_deliverySequence_key" ON "NotificationFeedItem"("recipientKey", "deliverySequence");
CREATE INDEX "NotificationFeedItem_audience_recipientKey_archivedAt_deliverySequence_idx" ON "NotificationFeedItem"("audience", "recipientKey", "archivedAt", "deliverySequence");

CREATE UNIQUE INDEX "NotificationRecipientState_recipientKey_key" ON "NotificationRecipientState"("recipientKey");
CREATE UNIQUE INDEX "NotificationRecipientState_customerId_key" ON "NotificationRecipientState"("customerId");
CREATE UNIQUE INDEX "NotificationRecipientState_operatorId_key" ON "NotificationRecipientState"("operatorId");
CREATE INDEX "NotificationRecipientState_audience_recipientKey_idx" ON "NotificationRecipientState"("audience", "recipientKey");

CREATE UNIQUE INDEX "NotificationSocketSession_tokenHash_key" ON "NotificationSocketSession"("tokenHash");
CREATE INDEX "NotificationSocketSession_recipientKey_expiresAt_idx" ON "NotificationSocketSession"("recipientKey", "expiresAt");
CREATE INDEX "NotificationSocketSession_customerId_expiresAt_idx" ON "NotificationSocketSession"("customerId", "expiresAt");
CREATE INDEX "NotificationSocketSession_operatorId_expiresAt_idx" ON "NotificationSocketSession"("operatorId", "expiresAt");

ALTER TABLE "NotificationRecipientState" ADD CONSTRAINT "NotificationRecipientState_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NotificationRecipientState" ADD CONSTRAINT "NotificationRecipientState_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NotificationSocketSession" ADD CONSTRAINT "NotificationSocketSession_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NotificationSocketSession" ADD CONSTRAINT "NotificationSocketSession_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DROP TABLE "NotificationDeliveryCursor";
