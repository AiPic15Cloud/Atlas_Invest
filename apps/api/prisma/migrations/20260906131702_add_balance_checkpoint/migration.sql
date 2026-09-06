-- CreateTable
CREATE TABLE "BalanceCheckpoint" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "statedBalance" DECIMAL(12,2) NOT NULL,
    "expectedBalance" DECIMAL(12,2),
    "discrepancy" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bankAccountId" TEXT NOT NULL,

    CONSTRAINT "BalanceCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BalanceCheckpoint_bankAccountId_year_month_idx" ON "BalanceCheckpoint"("bankAccountId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "BalanceCheckpoint_bankAccountId_year_month_key" ON "BalanceCheckpoint"("bankAccountId", "year", "month");

-- AddForeignKey
ALTER TABLE "BalanceCheckpoint" ADD CONSTRAINT "BalanceCheckpoint_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
