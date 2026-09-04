-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('NON_EVALUE', 'A_GARDER', 'A_SURVEILLER', 'A_RESILIER');

-- CreateEnum
CREATE TYPE "UsageFrequency" AS ENUM ('QUOTIDIEN', 'HEBDOMADAIRE', 'MENSUEL', 'RARE', 'JAMAIS');

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "posteKey" TEXT NOT NULL,
    "merchantLabel" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'NON_EVALUE',
    "lastUsedAt" TIMESTAMP(3),
    "usageFrequency" "UsageFrequency",
    "cancelReminderAt" TIMESTAMP(3),
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "firstSeenMonth" INTEGER NOT NULL,
    "firstSeenYear" INTEGER NOT NULL,
    "lastSeenMonth" INTEGER NOT NULL,
    "lastSeenYear" INTEGER NOT NULL,
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_posteKey_key" ON "Subscription"("userId", "posteKey");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
