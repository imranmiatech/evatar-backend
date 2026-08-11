-- Partner product catalog for partner panel product management.
CREATE TYPE "PartnerProductCategory" AS ENUM ('PRODUCE', 'DAIRY', 'BAKERY', 'PANTRY', 'BABY', 'FRUIT', 'MEAT', 'OTHER');
CREATE TYPE "PartnerProductUnit" AS ENUM ('LITER', 'GRAM', 'PCS', 'PACK', 'OTHER');
CREATE TYPE "PartnerProductAvailability" AS ENUM ('IN_STOCK', 'OUT_OF_STOCK', 'LIMITED');
CREATE TYPE "PartnerProductStatus" AS ENUM ('DRAFT', 'PUBLISHED');

CREATE TABLE "partner_products" (
    "id" TEXT NOT NULL,
    "partnerUserId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "category" "PartnerProductCategory" NOT NULL,
    "sku" TEXT,
    "tags" TEXT[],
    "price" DECIMAL(10,2) NOT NULL,
    "unit" "PartnerProductUnit" NOT NULL,
    "availability" "PartnerProductAvailability" NOT NULL DEFAULT 'IN_STOCK',
    "status" "PartnerProductStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_products_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "partner_products_partnerUserId_sku_key" ON "partner_products"("partnerUserId", "sku");
CREATE INDEX "partner_products_partnerUserId_status_createdAt_idx" ON "partner_products"("partnerUserId", "status", "createdAt");
CREATE INDEX "partner_products_partnerUserId_category_idx" ON "partner_products"("partnerUserId", "category");

ALTER TABLE "partner_products" ADD CONSTRAINT "partner_products_partnerUserId_fkey" FOREIGN KEY ("partnerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
