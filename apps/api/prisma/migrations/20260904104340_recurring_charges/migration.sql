-- CreateTable
CREATE TABLE "RecurringCharge" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "dayOfMonth" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bankAccountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "RecurringCharge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecurringCharge_bankAccountId_idx" ON "RecurringCharge"("bankAccountId");

-- CreateIndex
CREATE INDEX "RecurringCharge_userId_idx" ON "RecurringCharge"("userId");

-- AddForeignKey
ALTER TABLE "RecurringCharge" ADD CONSTRAINT "RecurringCharge_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringCharge" ADD CONSTRAINT "RecurringCharge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
