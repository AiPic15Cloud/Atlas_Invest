-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "wasteful" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "wastefulReviewed" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "WastefulRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "posteKey" TEXT NOT NULL,
    "wasteful" BOOLEAN NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WastefulRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WastefulRule_userId_posteKey_key" ON "WastefulRule"("userId", "posteKey");

-- AddForeignKey
ALTER TABLE "WastefulRule" ADD CONSTRAINT "WastefulRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
