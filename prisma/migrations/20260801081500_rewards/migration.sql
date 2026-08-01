-- CreateEnum
CREATE TYPE "RewardLedgerEntryType" AS ENUM ('EARN', 'SPEND', 'REFUND', 'ADJUSTMENT', 'VOID');

-- CreateEnum
CREATE TYPE "RewardLedgerSourceType" AS ENUM ('DAY_ACTIVITY', 'CARE_MODULE_ASSIGNMENT', 'REWARD_REDEMPTION', 'MANUAL_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "RewardOfferStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RewardRedemptionStatus" AS ENUM ('ACTIVE', 'USED', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "reward_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "lifetimeEarned" INTEGER NOT NULL DEFAULT 0,
    "lifetimeSpent" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reward_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_ledger_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entryType" "RewardLedgerEntryType" NOT NULL,
    "sourceType" "RewardLedgerSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reward_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_offers" (
    "id" TEXT NOT NULL,
    "partnerUserId" TEXT NOT NULL,
    "storeId" TEXT,
    "title" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "pointsCost" INTEGER NOT NULL,
    "availableQuantity" INTEGER,
    "redeemedCount" INTEGER NOT NULL DEFAULT 0,
    "status" "RewardOfferStatus" NOT NULL DEFAULT 'DRAFT',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reward_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_redemptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "pointsSpent" INTEGER NOT NULL,
    "status" "RewardRedemptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reward_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reward_accounts_userId_key" ON "reward_accounts"("userId");

-- CreateIndex
CREATE INDEX "reward_accounts_balance_idx" ON "reward_accounts"("balance");

-- CreateIndex
CREATE UNIQUE INDEX "reward_ledger_entries_entryType_sourceType_sourceId_key" ON "reward_ledger_entries"("entryType", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "reward_ledger_entries_userId_createdAt_idx" ON "reward_ledger_entries"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "reward_ledger_entries_entryType_createdAt_idx" ON "reward_ledger_entries"("entryType", "createdAt");

-- CreateIndex
CREATE INDEX "reward_ledger_entries_sourceType_sourceId_idx" ON "reward_ledger_entries"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "reward_offers_partnerUserId_status_createdAt_idx" ON "reward_offers"("partnerUserId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "reward_offers_storeId_idx" ON "reward_offers"("storeId");

-- CreateIndex
CREATE INDEX "reward_offers_status_startsAt_endsAt_idx" ON "reward_offers"("status", "startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "reward_redemptions_code_key" ON "reward_redemptions"("code");

-- CreateIndex
CREATE INDEX "reward_redemptions_userId_createdAt_idx" ON "reward_redemptions"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "reward_redemptions_offerId_status_idx" ON "reward_redemptions"("offerId", "status");

-- CreateIndex
CREATE INDEX "reward_redemptions_code_idx" ON "reward_redemptions"("code");

-- CreateIndex
CREATE INDEX "reward_redemptions_status_expiresAt_idx" ON "reward_redemptions"("status", "expiresAt");

-- AddForeignKey
ALTER TABLE "reward_accounts" ADD CONSTRAINT "reward_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_ledger_entries" ADD CONSTRAINT "reward_ledger_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_offers" ADD CONSTRAINT "reward_offers_partnerUserId_fkey" FOREIGN KEY ("partnerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_offers" ADD CONSTRAINT "reward_offers_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "reward_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill existing completed nanny tasks as reward earnings.
INSERT INTO "reward_ledger_entries" (
    "id",
    "userId",
    "entryType",
    "sourceType",
    "sourceId",
    "points",
    "balanceAfter",
    "description",
    "metadata",
    "createdAt"
)
SELECT
    'earn-day-' || da."id",
    daf."submittedByUserId",
    'EARN'::"RewardLedgerEntryType",
    'DAY_ACTIVITY'::"RewardLedgerSourceType",
    da."id",
    2,
    2,
    'Completed task',
    jsonb_build_object('title', da."title", 'migrated', true),
    daf."submittedAt"
FROM "DayActivity" da
INNER JOIN "DayActivityFeedback" daf ON daf."dayActivityId" = da."id"
WHERE da."status" = 'COMPLETED';

-- Backfill existing completed care modules using their stored point value.
INSERT INTO "reward_ledger_entries" (
    "id",
    "userId",
    "entryType",
    "sourceType",
    "sourceId",
    "points",
    "balanceAfter",
    "description",
    "metadata",
    "createdAt"
)
SELECT
    'earn-care-' || cma."id",
    cma."nannyUserId",
    'EARN'::"RewardLedgerEntryType",
    'CARE_MODULE_ASSIGNMENT'::"RewardLedgerSourceType",
    cma."id",
    cma."pointsEarned",
    cma."pointsEarned",
    'Completed care module',
    jsonb_build_object('moduleId', cma."moduleId", 'childId', cma."childId", 'migrated', true),
    COALESCE(cma."pointsAwardedAt", cma."completedAt", cma."updatedAt")
FROM "care_module_assignments" cma
WHERE cma."status" = 'COMPLETED'
AND cma."pointsEarned" > 0
AND cma."pointsAwardedAt" IS NOT NULL;

-- Build account balances from the migrated ledger.
INSERT INTO "reward_accounts" (
    "id",
    "userId",
    "balance",
    "lifetimeEarned",
    "lifetimeSpent",
    "createdAt",
    "updatedAt"
)
SELECT
    'reward-account-' || "userId",
    "userId",
    SUM("points"),
    SUM("points"),
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "reward_ledger_entries"
WHERE "entryType" = 'EARN'
GROUP BY "userId";
