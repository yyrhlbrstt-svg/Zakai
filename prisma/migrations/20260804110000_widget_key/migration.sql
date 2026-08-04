-- CreateTable
CREATE TABLE "WidgetKey" (
    "key" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WidgetKey_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "WidgetKey_domain_idx" ON "WidgetKey"("domain");
