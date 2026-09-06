-- CreateTable
CREATE TABLE "WealthSnapshot" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "netWorth" DECIMAL(12,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "WealthSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WealthSnapshot_userId_year_month_key" ON "WealthSnapshot"("userId", "year", "month");

-- AddForeignKey
ALTER TABLE "WealthSnapshot" ADD CONSTRAINT "WealthSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
