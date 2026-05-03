-- CreateTable
CREATE TABLE "OpportunityLog" (
    "id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpportunityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OpportunityLog_createdAt_idx" ON "OpportunityLog"("createdAt");
