-- AlterTable
ALTER TABLE "kitchen_items" ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "kitchen_items_category_idx" ON "kitchen_items"("category");

-- CreateIndex
CREATE INDEX "kitchen_items_isArchived_idx" ON "kitchen_items"("isArchived");
