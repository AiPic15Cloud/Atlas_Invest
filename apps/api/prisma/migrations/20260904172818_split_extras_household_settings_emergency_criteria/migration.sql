-- AlterTable
ALTER TABLE "EmergencyFundProfile" ADD COLUMN     "assetLiquidity" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "emotionalComfort" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "safetyNet" INTEGER NOT NULL DEFAULT 3;

-- AlterTable
ALTER TABLE "Household" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'EUR',
ADD COLUMN     "fiscalYearStartMonth" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "ExpenseAssignment" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expenseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "ExpenseAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseAssignment_expenseId_key" ON "ExpenseAssignment"("expenseId");

-- CreateIndex
CREATE INDEX "ExpenseAssignment_userId_idx" ON "ExpenseAssignment"("userId");

-- AddForeignKey
ALTER TABLE "ExpenseAssignment" ADD CONSTRAINT "ExpenseAssignment_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseAssignment" ADD CONSTRAINT "ExpenseAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
