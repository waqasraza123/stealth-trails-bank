ALTER TABLE "Customer"
ADD COLUMN "depositEmailNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "withdrawalEmailNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "loanEmailNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "productUpdateEmailNotificationsEnabled" BOOLEAN NOT NULL DEFAULT false;
