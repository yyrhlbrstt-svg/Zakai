-- CreateTable
CREATE TABLE "ZakaiEvent" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "caseId" TEXT,
    "institution" TEXT,
    "domain" TEXT,
    "payload" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ZakaiEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ZakaiEvent_eventType_occurredAt_idx" ON "ZakaiEvent"("eventType", "occurredAt");

-- CreateIndex
CREATE INDEX "ZakaiEvent_institution_occurredAt_idx" ON "ZakaiEvent"("institution", "occurredAt");

-- CreateIndex
CREATE INDEX "ZakaiEvent_caseId_idx" ON "ZakaiEvent"("caseId");

-- AddForeignKey
ALTER TABLE "ZakaiEvent" ADD CONSTRAINT "ZakaiEvent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE SET NULL ON UPDATE CASCADE;

