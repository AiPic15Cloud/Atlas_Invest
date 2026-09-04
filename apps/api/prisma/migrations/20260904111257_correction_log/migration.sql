-- CreateEnum
CREATE TYPE "CorrectionType" AS ENUM ('WASTEFUL_EXPENSE', 'SUBSCRIPTION_STATUS');

-- CreateTable
CREATE TABLE "CorrectionLog" (
    "id" TEXT NOT NULL,
    "type" "CorrectionType" NOT NULL,
    "label" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "CorrectionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CorrectionLog_userId_createdAt_idx" ON "CorrectionLog"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "CorrectionLog" ADD CONSTRAINT "CorrectionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
