-- CreateEnum
CREATE TYPE "BudgetMethod" AS ENUM ('CONFORTABLE_50_30_20', 'TENDUE_60_25_15', 'TRES_TENDUE_70_20_10', 'BASE_ZERO', 'QUATRE_VINGT_VINGT', 'CASCADES_3');

-- CreateEnum
CREATE TYPE "BudgetCategory" AS ENUM ('BESOINS', 'ENVIES', 'EPARGNE');

-- CreateTable
CREATE TABLE "BudgetTemplate" (
    "id" TEXT NOT NULL,
    "method" "BudgetMethod" NOT NULL,
    "monthlyIncome" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "BudgetTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetItem" (
    "id" TEXT NOT NULL,
    "category" "BudgetCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "monthlyAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "essential" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "templateId" TEXT NOT NULL,
    "parentId" TEXT,

    CONSTRAINT "BudgetItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BudgetTemplate_userId_key" ON "BudgetTemplate"("userId");

-- CreateIndex
CREATE INDEX "BudgetItem_templateId_category_idx" ON "BudgetItem"("templateId", "category");

-- AddForeignKey
ALTER TABLE "BudgetTemplate" ADD CONSTRAINT "BudgetTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetItem" ADD CONSTRAINT "BudgetItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "BudgetTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetItem" ADD CONSTRAINT "BudgetItem_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "BudgetItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
