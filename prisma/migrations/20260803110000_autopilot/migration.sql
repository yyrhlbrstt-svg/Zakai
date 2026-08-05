-- Autopilot law/price source snapshots and run log.
CREATE TABLE "AutopilotSourceSnapshot" (
    "sourceUrl" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "rightId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "lastSnippet" TEXT,
    "lastChangedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutopilotSourceSnapshot_pkey" PRIMARY KEY ("sourceUrl")
);

CREATE TABLE "AutopilotRun" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "summary" TEXT NOT NULL,
    "findings" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutopilotRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AutopilotRun_jobId_createdAt_idx" ON "AutopilotRun"("jobId", "createdAt");
