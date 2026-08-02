-- CreateTable
CREATE TABLE "ReferenceVerifier" (
    "institutionId" TEXT NOT NULL,
    "displayNameHe" TEXT NOT NULL,
    "displayNameEn" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'reference',
    "listedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferenceVerifier_pkey" PRIMARY KEY ("institutionId")
);

-- CreateIndex
CREATE INDEX "ReferenceVerifier_listedAt_idx" ON "ReferenceVerifier"("listedAt");
