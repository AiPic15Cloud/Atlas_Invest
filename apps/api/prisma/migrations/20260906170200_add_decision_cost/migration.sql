-- CreateTable
CREATE TABLE "DecisionCost" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "DecisionCost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionCostItem" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "monthlyAmount" DECIMAL(12,2) NOT NULL,
    "decisionCostId" TEXT NOT NULL,

    CONSTRAINT "DecisionCostItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DecisionCost_userId_idx" ON "DecisionCost"("userId");

-- CreateIndex
CREATE INDEX "DecisionCostItem_decisionCostId_idx" ON "DecisionCostItem"("decisionCostId");

-- AddForeignKey
ALTER TABLE "DecisionCost" ADD CONSTRAINT "DecisionCost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionCostItem" ADD CONSTRAINT "DecisionCostItem_decisionCostId_fkey" FOREIGN KEY ("decisionCostId") REFERENCES "DecisionCost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
