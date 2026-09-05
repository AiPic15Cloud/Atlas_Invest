-- CreateTable
CREATE TABLE "MonthlyBudgetOverride" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "category" "BudgetCategory" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyBudgetOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyBudgetOverride_userId_year_month_category_key" ON "MonthlyBudgetOverride"("userId", "year", "month", "category");

-- AddForeignKey
ALTER TABLE "MonthlyBudgetOverride" ADD CONSTRAINT "MonthlyBudgetOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
