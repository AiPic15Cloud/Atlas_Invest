-- CreateEnum
CREATE TYPE "WealthCategory" AS ENUM ('IMMOBILIER', 'VEHICULE', 'PLACEMENT', 'AUTRE_ACTIF', 'CREDIT', 'AUTRE_DETTE');

-- CreateTable
CREATE TABLE "WealthItem" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" "WealthCategory" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "WealthItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WealthItem_userId_idx" ON "WealthItem"("userId");

-- AddForeignKey
ALTER TABLE "WealthItem" ADD CONSTRAINT "WealthItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
