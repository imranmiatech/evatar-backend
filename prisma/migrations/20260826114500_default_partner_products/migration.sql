-- CreateTable
CREATE TABLE "default_partner_products" (
    "id" TEXT NOT NULL,
    "createdById" TEXT,
    "productName" TEXT NOT NULL,
    "category" "PartnerProductCategory" NOT NULL,
    "sku" TEXT,
    "tags" TEXT[],
    "price" DECIMAL(10,2) NOT NULL,
    "unit" "PartnerProductUnit" NOT NULL,
    "availability" "PartnerProductAvailability" NOT NULL DEFAULT 'IN_STOCK',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "default_partner_products_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "partner_products"
ADD COLUMN "defaultProductId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "default_partner_products_sku_key" ON "default_partner_products"("sku");

-- CreateIndex
CREATE INDEX "default_partner_products_category_isActive_createdAt_idx" ON "default_partner_products"("category", "isActive", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "partner_products_partnerUserId_defaultProductId_key" ON "partner_products"("partnerUserId", "defaultProductId");

-- CreateIndex
CREATE INDEX "partner_products_defaultProductId_idx" ON "partner_products"("defaultProductId");

-- AddForeignKey
ALTER TABLE "partner_products"
ADD CONSTRAINT "partner_products_defaultProductId_fkey"
FOREIGN KEY ("defaultProductId") REFERENCES "default_partner_products"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "default_partner_products"
ADD CONSTRAINT "default_partner_products_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
