-- CreateEnum
CREATE TYPE "ValuationSource" AS ENUM ('MANUELLE', 'MARCHE', 'ESTIMATION', 'HISTORIQUE');

-- CreateTable
CREATE TABLE "AssetValuation" (
    "id" TEXT NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "valuationDate" TIMESTAMP(3) NOT NULL,
    "source" "ValuationSource" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "wealthItemId" TEXT NOT NULL,

    CONSTRAINT "AssetValuation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssetValuation_wealthItemId_valuationDate_idx" ON "AssetValuation"("wealthItemId", "valuationDate");

-- AddForeignKey
ALTER TABLE "AssetValuation" ADD CONSTRAINT "AssetValuation_wealthItemId_fkey" FOREIGN KEY ("wealthItemId") REFERENCES "WealthItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
