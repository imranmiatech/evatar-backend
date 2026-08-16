CREATE TYPE "PartnerOfferAdCategory" AS ENUM ('RECIPE', 'ACTIVITY');

ALTER TABLE "partner_offers" ADD COLUMN "adCategory" "PartnerOfferAdCategory";

CREATE INDEX "partner_offers_adCategory_status_idx" ON "partner_offers"("adCategory", "status");
