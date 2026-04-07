-- AlterTable
ALTER TABLE "PlatformAlertDelivery"
ADD COLUMN "escalatedFromDeliveryId" TEXT,
ADD COLUMN "escalationLevel" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "escalationReason" TEXT;

-- CreateIndex
CREATE INDEX "PlatformAlertDelivery_escalatedFromDeliveryId_createdAt_idx"
ON "PlatformAlertDelivery"("escalatedFromDeliveryId", "createdAt");

-- CreateIndex
CREATE INDEX "PlatformAlertDelivery_platformAlertId_escalationLevel_createdAt_idx"
ON "PlatformAlertDelivery"("platformAlertId", "escalationLevel", "createdAt");

-- AddForeignKey
ALTER TABLE "PlatformAlertDelivery"
ADD CONSTRAINT "PlatformAlertDelivery_escalatedFromDeliveryId_fkey"
FOREIGN KEY ("escalatedFromDeliveryId") REFERENCES "PlatformAlertDelivery"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
