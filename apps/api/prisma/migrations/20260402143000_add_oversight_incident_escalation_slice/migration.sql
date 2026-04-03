CREATE TYPE "OversightIncidentType" AS ENUM (
  'customer_manual_resolution_spike',
  'operator_manual_resolution_spike'
);

CREATE TYPE "OversightIncidentStatus" AS ENUM (
  'open',
  'in_progress',
  'resolved',
  'dismissed'
);

CREATE TYPE "OversightIncidentEventType" AS ENUM (
  'opened',
  'started',
  'note_added',
  'resolved',
  'dismissed'
);

CREATE TABLE "OversightIncident" (
  "id" TEXT NOT NULL,
  "incidentType" "OversightIncidentType" NOT NULL,
  "status" "OversightIncidentStatus" NOT NULL DEFAULT 'open',
  "reasonCode" TEXT,
  "summaryNote" TEXT,
  "subjectCustomerId" TEXT,
  "subjectCustomerAccountId" TEXT,
  "subjectOperatorId" TEXT,
  "subjectOperatorRole" TEXT,
  "assignedOperatorId" TEXT,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "dismissedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OversightIncident_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OversightIncidentEvent" (
  "id" TEXT NOT NULL,
  "oversightIncidentId" TEXT NOT NULL,
  "actorType" TEXT NOT NULL,
  "actorId" TEXT,
  "eventType" "OversightIncidentEventType" NOT NULL,
  "note" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OversightIncidentEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OversightIncident_incidentType_status_idx"
ON "OversightIncident"("incidentType", "status");

CREATE INDEX "OversightIncident_subjectCustomerAccountId_idx"
ON "OversightIncident"("subjectCustomerAccountId");

CREATE INDEX "OversightIncident_subjectOperatorId_idx"
ON "OversightIncident"("subjectOperatorId");

CREATE INDEX "OversightIncident_assignedOperatorId_status_idx"
ON "OversightIncident"("assignedOperatorId", "status");

CREATE INDEX "OversightIncident_reasonCode_idx"
ON "OversightIncident"("reasonCode");

CREATE INDEX "OversightIncidentEvent_oversightIncidentId_createdAt_idx"
ON "OversightIncidentEvent"("oversightIncidentId", "createdAt");

CREATE INDEX "OversightIncidentEvent_eventType_createdAt_idx"
ON "OversightIncidentEvent"("eventType", "createdAt");

ALTER TABLE "OversightIncident"
ADD CONSTRAINT "OversightIncident_subjectCustomerId_fkey"
FOREIGN KEY ("subjectCustomerId")
REFERENCES "Customer"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "OversightIncident"
ADD CONSTRAINT "OversightIncident_subjectCustomerAccountId_fkey"
FOREIGN KEY ("subjectCustomerAccountId")
REFERENCES "CustomerAccount"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "OversightIncidentEvent"
ADD CONSTRAINT "OversightIncidentEvent_oversightIncidentId_fkey"
FOREIGN KEY ("oversightIncidentId")
REFERENCES "OversightIncident"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;
