-- CreateTable
CREATE TABLE "ImportCategoryMemory" (
    "id" TEXT NOT NULL,
    "merchantKey" TEXT NOT NULL,
    "poste" TEXT NOT NULL,
    "category" "BudgetCategory" NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "ImportCategoryMemory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ImportCategoryMemory_userId_merchantKey_key" ON "ImportCategoryMemory"("userId", "merchantKey");

-- AddForeignKey
ALTER TABLE "ImportCategoryMemory" ADD CONSTRAINT "ImportCategoryMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
