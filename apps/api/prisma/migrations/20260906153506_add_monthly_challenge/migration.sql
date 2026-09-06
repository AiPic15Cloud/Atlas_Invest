-- CreateTable
CREATE TABLE "MonthlyChallenge" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "targetAmount" DECIMAL(12,2) NOT NULL,
    "stretchGoalAmount" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "householdId" TEXT NOT NULL,

    CONSTRAINT "MonthlyChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyChallenge_householdId_year_month_key" ON "MonthlyChallenge"("householdId", "year", "month");

-- AddForeignKey
ALTER TABLE "MonthlyChallenge" ADD CONSTRAINT "MonthlyChallenge_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;
