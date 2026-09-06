-- CreateEnum
CREATE TYPE "SavedEuroAllocation" AS ENUM ('OBJECTIF', 'SECURITE', 'INVESTISSEMENT', 'DISPONIBLE');

-- CreateTable
CREATE TABLE "SavedEuroEvent" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "allocation" "SavedEuroAllocation" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "savingsGoalId" TEXT,

    CONSTRAINT "SavedEuroEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedEuroEvent_userId_createdAt_idx" ON "SavedEuroEvent"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "SavedEuroEvent" ADD CONSTRAINT "SavedEuroEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedEuroEvent" ADD CONSTRAINT "SavedEuroEvent_savingsGoalId_fkey" FOREIGN KEY ("savingsGoalId") REFERENCES "SavingsGoal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
