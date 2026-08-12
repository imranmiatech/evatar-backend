CREATE TYPE "PartnerOfferStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'INACTIVE', 'EXPIRED', 'REJECTED');
CREATE TYPE "PartnerOfferType" AS ENUM ('FIXED_DISCOUNT', 'PRODUCT_BASED');
CREATE TYPE "PartnerOfferRedemptionFlow" AS ENUM ('IN_STORE', 'IN_ALUREI');

CREATE TABLE "partner_offers" (
    "id" TEXT NOT NULL,
    "partnerUserId" TEXT NOT NULL,
    "redemptionFlow" "PartnerOfferRedemptionFlow" NOT NULL,
    "offerType" "PartnerOfferType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "heroImageUrl" TEXT,
    "useDefaultHeroImage" BOOLEAN NOT NULL DEFAULT false,
    "productId" TEXT,
    "productName" TEXT,
    "category" "PartnerProductCategory",
    "minimumSpend" DECIMAL(10,2),
    "deductionPercentage" DECIMAL(5,2),
    "requiredAlurei" INTEGER NOT NULL,
    "eligiblePlans" TEXT[],
    "benefitTitle" TEXT,
    "benefitDescription" TEXT,
    "terms" TEXT,
    "availableAllOutlets" BOOLEAN NOT NULL DEFAULT false,
    "recommendExternal" BOOLEAN NOT NULL DEFAULT false,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" "PartnerOfferStatus" NOT NULL DEFAULT 'DRAFT',
    "rejectionReason" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_offers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "partner_offer_locations" (
    "id" TEXT NOT NULL,
    "partnerOfferId" TEXT NOT NULL,
    "storeId" TEXT,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "mapUrl" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_offer_locations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "partner_offers_partnerUserId_status_createdAt_idx" ON "partner_offers"("partnerUserId", "status", "createdAt");
CREATE INDEX "partner_offers_partnerUserId_offerType_idx" ON "partner_offers"("partnerUserId", "offerType");
CREATE INDEX "partner_offers_redemptionFlow_status_idx" ON "partner_offers"("redemptionFlow", "status");
CREATE INDEX "partner_offers_category_status_idx" ON "partner_offers"("category", "status");
CREATE INDEX "partner_offers_startDate_endDate_idx" ON "partner_offers"("startDate", "endDate");
CREATE INDEX "partner_offer_locations_partnerOfferId_idx" ON "partner_offer_locations"("partnerOfferId");
CREATE INDEX "partner_offer_locations_storeId_idx" ON "partner_offer_locations"("storeId");

ALTER TABLE "partner_offers" ADD CONSTRAINT "partner_offers_partnerUserId_fkey" FOREIGN KEY ("partnerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "partner_offers" ADD CONSTRAINT "partner_offers_productId_fkey" FOREIGN KEY ("productId") REFERENCES "partner_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "partner_offer_locations" ADD CONSTRAINT "partner_offer_locations_partnerOfferId_fkey" FOREIGN KEY ("partnerOfferId") REFERENCES "partner_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
