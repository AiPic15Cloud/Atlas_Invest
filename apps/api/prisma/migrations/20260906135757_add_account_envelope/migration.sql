-- CreateTable
CREATE TABLE "AccountEnvelope" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bankAccountId" TEXT NOT NULL,

    CONSTRAINT "AccountEnvelope_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountEnvelope_bankAccountId_idx" ON "AccountEnvelope"("bankAccountId");

-- AddForeignKey
ALTER TABLE "AccountEnvelope" ADD CONSTRAINT "AccountEnvelope_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
