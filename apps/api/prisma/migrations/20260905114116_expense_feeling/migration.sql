-- CreateEnum
CREATE TYPE "ExpenseFeeling" AS ENUM ('SATISFAIT', 'NEUTRE', 'REGRET');

-- AlterTable: add the new nullable feeling columns alongside the old ones
ALTER TABLE "Expense" ADD COLUMN "feeling" "ExpenseFeeling";
ALTER TABLE "Expense" ADD COLUMN "feelingReviewed" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: preserve the old binary marking as feeling data.
-- wasteful = true            -> REGRET (reviewed status carried over)
-- wasteful = false + reviewed -> SATISFAIT (user had explicitly confirmed it was fine)
-- wasteful = false + not reviewed -> left NULL (never rated)
UPDATE "Expense" SET "feeling" = 'REGRET', "feelingReviewed" = "wastefulReviewed" WHERE "wasteful" = true;
UPDATE "Expense" SET "feeling" = 'SATISFAIT', "feelingReviewed" = true WHERE "wasteful" = false AND "wastefulReviewed" = true;

-- DropColumns
ALTER TABLE "Expense" DROP COLUMN "wasteful";
ALTER TABLE "Expense" DROP COLUMN "wastefulReviewed";

-- CreateTable
CREATE TABLE "FeelingRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "posteKey" TEXT NOT NULL,
    "feeling" "ExpenseFeeling" NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeelingRule_pkey" PRIMARY KEY ("id")
);

-- Backfill FeelingRule from the old WastefulRule table
INSERT INTO "FeelingRule" ("id", "userId", "posteKey", "feeling", "updatedAt")
SELECT "id", "userId", "posteKey", CASE WHEN "wasteful" THEN 'REGRET'::"ExpenseFeeling" ELSE 'SATISFAIT'::"ExpenseFeeling" END, "updatedAt"
FROM "WastefulRule";

-- DropTable
DROP TABLE "WastefulRule";

-- CreateIndex
CREATE UNIQUE INDEX "FeelingRule_userId_posteKey_key" ON "FeelingRule"("userId", "posteKey");

-- AddForeignKey
ALTER TABLE "FeelingRule" ADD CONSTRAINT "FeelingRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
