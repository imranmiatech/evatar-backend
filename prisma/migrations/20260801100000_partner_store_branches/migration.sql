-- AlterTable
ALTER TABLE "stores" ADD COLUMN "address" TEXT,
ADD COLUMN "city" TEXT,
ADD COLUMN "latitude" DOUBLE PRECISION,
ADD COLUMN "longitude" DOUBLE PRECISION,
ADD COLUMN "mapUrl" TEXT;

-- CreateTable
CREATE TABLE "reward_offer_stores" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reward_offer_stores_pkey" PRIMARY KEY ("id")
);

-- Backfill new join table from the previous single-store offer field.
INSERT INTO "reward_offer_stores" ("id", "offerId", "storeId")
SELECT 'reward-offer-store-' || "id" || '-' || "storeId", "id", "storeId"
FROM "reward_offers"
WHERE "storeId" IS NOT NULL;

-- CreateIndex
CREATE INDEX "stores_userId_createdAt_idx" ON "stores"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "reward_offer_stores_offerId_storeId_key" ON "reward_offer_stores"("offerId", "storeId");

-- CreateIndex
CREATE INDEX "reward_offer_stores_offerId_idx" ON "reward_offer_stores"("offerId");

-- CreateIndex
CREATE INDEX "reward_offer_stores_storeId_idx" ON "reward_offer_stores"("storeId");

-- AddForeignKey
ALTER TABLE "reward_offer_stores" ADD CONSTRAINT "reward_offer_stores_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "reward_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_offer_stores" ADD CONSTRAINT "reward_offer_stores_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
