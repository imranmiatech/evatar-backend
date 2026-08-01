-- CreateEnum
CREATE TYPE "RewardOfferChannel" AS ENUM ('ONLINE', 'IN_STORE', 'BOTH');

-- CreateEnum
CREATE TYPE "RewardClaimMethod" AS ENUM ('ONLINE', 'IN_STORE');

-- AlterTable
ALTER TABLE "reward_offers" ADD COLUMN "includedTitle" TEXT,
ADD COLUMN "includedDescription" TEXT,
ADD COLUMN "terms" TEXT,
ADD COLUMN "channel" "RewardOfferChannel" NOT NULL DEFAULT 'BOTH',
ADD COLUMN "onlineCouponCode" TEXT,
ADD COLUMN "websiteUrl" TEXT;

-- AlterTable
ALTER TABLE "reward_redemptions" ADD COLUMN "claimMethod" "RewardClaimMethod" NOT NULL DEFAULT 'ONLINE',
ADD COLUMN "couponCode" TEXT,
ADD COLUMN "qrToken" TEXT,
ADD COLUMN "qrPayload" TEXT,
ADD COLUMN "usedByPartnerUserId" TEXT;

-- CreateTable
CREATE TABLE "reward_offer_locations" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reward_offer_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_saved_offers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reward_saved_offers_pkey" PRIMARY KEY ("id")
);

-- Backfill online coupon snapshots for existing online-style redemptions.
UPDATE "reward_redemptions" rr
SET "couponCode" = rr."code"
WHERE rr."couponCode" IS NULL;

-- CreateIndex
CREATE INDEX "reward_offers_channel_status_idx" ON "reward_offers"("channel", "status");

-- CreateIndex
CREATE UNIQUE INDEX "reward_redemptions_qrToken_key" ON "reward_redemptions"("qrToken");

-- CreateIndex
CREATE INDEX "reward_redemptions_qrToken_idx" ON "reward_redemptions"("qrToken");

-- CreateIndex
CREATE INDEX "reward_redemptions_claimMethod_status_idx" ON "reward_redemptions"("claimMethod", "status");

-- CreateIndex
CREATE INDEX "reward_offer_locations_offerId_idx" ON "reward_offer_locations"("offerId");

-- CreateIndex
CREATE UNIQUE INDEX "reward_saved_offers_userId_offerId_key" ON "reward_saved_offers"("userId", "offerId");

-- CreateIndex
CREATE INDEX "reward_saved_offers_userId_createdAt_idx" ON "reward_saved_offers"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "reward_saved_offers_offerId_idx" ON "reward_saved_offers"("offerId");

-- AddForeignKey
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_usedByPartnerUserId_fkey" FOREIGN KEY ("usedByPartnerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_offer_locations" ADD CONSTRAINT "reward_offer_locations_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "reward_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_saved_offers" ADD CONSTRAINT "reward_saved_offers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_saved_offers" ADD CONSTRAINT "reward_saved_offers_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "reward_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
