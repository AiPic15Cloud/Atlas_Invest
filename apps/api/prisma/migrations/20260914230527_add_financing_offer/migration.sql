-- CreateEnum
CREATE TYPE "FinancingType" AS ENUM ('IMMOBILIER', 'CONSOMMATION', 'VOITURE', 'TRAVAUX', 'AUTRE');

-- CreateTable
CREATE TABLE "FinancingOffer" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "FinancingType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "downPayment" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "durationMonths" INTEGER NOT NULL,
    "interestRatePercent" DECIMAL(6,3),
    "insuranceMonthly" DECIMAL(12,2),
    "fees" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "FinancingOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinancingOffer_userId_idx" ON "FinancingOffer"("userId");

-- AddForeignKey
ALTER TABLE "FinancingOffer" ADD CONSTRAINT "FinancingOffer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
