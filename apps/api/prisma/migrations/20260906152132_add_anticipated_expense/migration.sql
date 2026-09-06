-- CreateTable
CREATE TABLE "AnticipatedExpense" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "AnticipatedExpense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnticipatedExpense_userId_year_month_idx" ON "AnticipatedExpense"("userId", "year", "month");

-- AddForeignKey
ALTER TABLE "AnticipatedExpense" ADD CONSTRAINT "AnticipatedExpense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
