-- CreateTable
CREATE TABLE "Provision" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "annualAmount" DECIMAL(12,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Provision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Provision_userId_idx" ON "Provision"("userId");

-- AddForeignKey
ALTER TABLE "Provision" ADD CONSTRAINT "Provision_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
