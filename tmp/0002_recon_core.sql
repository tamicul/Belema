-- CreateEnum
CREATE TYPE "ReconRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "SourceFileType" AS ENUM ('SHOPIFY_PAYOUTS_CSV', 'BANK_STATEMENT_CSV');

-- CreateEnum
CREATE TYPE "ImportRowStatus" AS ENUM ('OK', 'WARNING', 'ERROR');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('MATCHED', 'NEEDS_REVIEW', 'REJECTED', 'PROPOSED');

-- CreateTable
CREATE TABLE "ReconciliationRun" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "status" "ReconRunStatus" NOT NULL DEFAULT 'QUEUED',
    "kind" TEXT NOT NULL DEFAULT 'BANK_RECONCILIATION',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "stats" JSONB NOT NULL DEFAULT '{}',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReconciliationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceFile" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "runId" TEXT,
    "type" "SourceFileType" NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "sha256" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "storageKey" TEXT,

    CONSTRAINT "SourceFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportedRowRaw" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "runId" TEXT,
    "sourceFileId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "status" "ImportRowStatus" NOT NULL DEFAULT 'OK',
    "raw" JSONB NOT NULL,
    "parsed" JSONB,
    "messages" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportedRowRaw_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalPayout" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "runId" TEXT,
    "sourceFileId" TEXT NOT NULL,
    "payoutId" TEXT NOT NULL,
    "payoutStatus" TEXT NOT NULL,
    "payoutDate" TIMESTAMP(3) NOT NULL,
    "payoutMonth" TEXT,
    "payoutCurrency" TEXT NOT NULL,
    "payoutAmount" DECIMAL(18,2) NOT NULL,
    "warnings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalPayoutLine" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "runId" TEXT,
    "sourceFileId" TEXT NOT NULL,
    "payoutDbId" TEXT NOT NULL,
    "txnId" TEXT NOT NULL,
    "txnType" TEXT NOT NULL,
    "txnProcessedAt" TIMESTAMP(3),
    "txnCurrency" TEXT,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalPayoutLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalBankTxn" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "runId" TEXT,
    "sourceFileId" TEXT NOT NULL,
    "postedDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "sortCode" TEXT,
    "accountNumber" TEXT,
    "moneyIn" DECIMAL(18,2) NOT NULL,
    "moneyOut" DECIMAL(18,2) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "balance" DECIMAL(18,2),
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalBankTxn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchResult" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "leftType" TEXT NOT NULL,
    "leftId" TEXT NOT NULL,
    "leftExternalId" TEXT,
    "rightType" TEXT NOT NULL,
    "rightId" TEXT NOT NULL,
    "rightExternalId" TEXT,
    "status" "MatchStatus" NOT NULL,
    "method" TEXT,
    "reasonCodes" TEXT[],
    "score" INTEGER,
    "explanation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReconciliationRun_orgId_createdAt_idx" ON "ReconciliationRun"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "ReconciliationRun_status_createdAt_idx" ON "ReconciliationRun"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SourceFile_orgId_uploadedAt_idx" ON "SourceFile"("orgId", "uploadedAt");

-- CreateIndex
CREATE INDEX "SourceFile_runId_idx" ON "SourceFile"("runId");

-- CreateIndex
CREATE INDEX "SourceFile_type_idx" ON "SourceFile"("type");

-- CreateIndex
CREATE INDEX "ImportedRowRaw_orgId_createdAt_idx" ON "ImportedRowRaw"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "ImportedRowRaw_runId_idx" ON "ImportedRowRaw"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "ImportedRowRaw_sourceFileId_rowNumber_key" ON "ImportedRowRaw"("sourceFileId", "rowNumber");

-- CreateIndex
CREATE INDEX "ExternalPayout_orgId_payoutDate_idx" ON "ExternalPayout"("orgId", "payoutDate");

-- CreateIndex
CREATE INDEX "ExternalPayout_runId_idx" ON "ExternalPayout"("runId");

-- CreateIndex
CREATE INDEX "ExternalPayout_payoutId_idx" ON "ExternalPayout"("payoutId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalPayout_sourceFileId_payoutId_key" ON "ExternalPayout"("sourceFileId", "payoutId");

-- CreateIndex
CREATE INDEX "ExternalPayoutLine_orgId_createdAt_idx" ON "ExternalPayoutLine"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "ExternalPayoutLine_runId_idx" ON "ExternalPayoutLine"("runId");

-- CreateIndex
CREATE INDEX "ExternalPayoutLine_txnId_idx" ON "ExternalPayoutLine"("txnId");

-- CreateIndex
CREATE INDEX "ExternalPayoutLine_payoutDbId_idx" ON "ExternalPayoutLine"("payoutDbId");

-- CreateIndex
CREATE INDEX "ExternalBankTxn_orgId_postedDate_idx" ON "ExternalBankTxn"("orgId", "postedDate");

-- CreateIndex
CREATE INDEX "ExternalBankTxn_runId_idx" ON "ExternalBankTxn"("runId");

-- CreateIndex
CREATE INDEX "ExternalBankTxn_amount_idx" ON "ExternalBankTxn"("amount");

-- CreateIndex
CREATE INDEX "MatchResult_orgId_createdAt_idx" ON "MatchResult"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "MatchResult_runId_idx" ON "MatchResult"("runId");

-- CreateIndex
CREATE INDEX "MatchResult_status_idx" ON "MatchResult"("status");

-- AddForeignKey
ALTER TABLE "ReconciliationRun" ADD CONSTRAINT "ReconciliationRun_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceFile" ADD CONSTRAINT "SourceFile_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceFile" ADD CONSTRAINT "SourceFile_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ReconciliationRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportedRowRaw" ADD CONSTRAINT "ImportedRowRaw_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "SourceFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalPayout" ADD CONSTRAINT "ExternalPayout_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "SourceFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalPayoutLine" ADD CONSTRAINT "ExternalPayoutLine_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "SourceFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalPayoutLine" ADD CONSTRAINT "ExternalPayoutLine_payoutDbId_fkey" FOREIGN KEY ("payoutDbId") REFERENCES "ExternalPayout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalBankTxn" ADD CONSTRAINT "ExternalBankTxn_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "SourceFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchResult" ADD CONSTRAINT "MatchResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ReconciliationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

