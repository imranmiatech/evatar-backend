DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'kitchen_items'
      AND column_name = 'adminStatus'
  ) THEN
    UPDATE "kitchen_items"
    SET "adminStatus" = 'ACTIVE'
    WHERE "adminStatus" IS NULL;

    ALTER TABLE "kitchen_items"
    ALTER COLUMN "adminStatus" SET DEFAULT 'ACTIVE',
    ALTER COLUMN "adminStatus" SET NOT NULL;
  END IF;
END $$;
