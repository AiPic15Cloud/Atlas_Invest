-- CreateTable
CREATE TABLE "EmergencyFundProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobStability" INTEGER NOT NULL,
    "dependentsLoad" INTEGER NOT NULL,
    "health" INTEGER NOT NULL,
    "alternativeIncome" INTEGER NOT NULL,
    "debtLevel" INTEGER NOT NULL,
    "monthsOverride" INTEGER,
    "currentSavedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "monthlySavingsCapacityOverride" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmergencyFundProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavingsEnvelope" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "monthlyAllocation" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "profileId" TEXT NOT NULL,

    CONSTRAINT "SavingsEnvelope_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmergencyFundProfile_userId_key" ON "EmergencyFundProfile"("userId");

-- AddForeignKey
ALTER TABLE "EmergencyFundProfile" ADD CONSTRAINT "EmergencyFundProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingsEnvelope" ADD CONSTRAINT "SavingsEnvelope_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "EmergencyFundProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
