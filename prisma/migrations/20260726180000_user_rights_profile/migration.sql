-- CreateTable
CREATE TABLE "UserRightsProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ageGroup" TEXT NOT NULL DEFAULT '25_44',
    "employment" TEXT NOT NULL DEFAULT 'employee',
    "children" INTEGER NOT NULL DEFAULT 0,
    "childrenUnder6" INTEGER NOT NULL DEFAULT 0,
    "renting" BOOLEAN NOT NULL DEFAULT false,
    "lowIncome" BOOLEAN NOT NULL DEFAULT false,
    "newImmigrant" BOOLEAN NOT NULL DEFAULT false,
    "dischargedSoldier" BOOLEAN NOT NULL DEFAULT false,
    "reservist" BOOLEAN NOT NULL DEFAULT false,
    "disability" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRightsProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserRightsProfile_userId_key" ON "UserRightsProfile"("userId");

-- CreateIndex
CREATE INDEX "UserRightsProfile_userId_idx" ON "UserRightsProfile"("userId");

-- AddForeignKey
ALTER TABLE "UserRightsProfile" ADD CONSTRAINT "UserRightsProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
