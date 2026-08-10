ALTER TABLE "shopping_list_items"
ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT,
ADD COLUMN IF NOT EXISTS "status" "ShoppingListItemStatus" NOT NULL DEFAULT 'NEEDED',
ADD COLUMN IF NOT EXISTS "isCustomOrder" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "addedToKitchen" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "shopping_list_items_createdByUserId_idx" ON "shopping_list_items"("createdByUserId");
CREATE INDEX IF NOT EXISTS "shopping_list_items_status_idx" ON "shopping_list_items"("status");
CREATE INDEX IF NOT EXISTS "shopping_list_items_isCustomOrder_idx" ON "shopping_list_items"("isCustomOrder");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'shopping_list_items_createdByUserId_fkey'
  ) THEN
    ALTER TABLE "shopping_list_items"
    ADD CONSTRAINT "shopping_list_items_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
