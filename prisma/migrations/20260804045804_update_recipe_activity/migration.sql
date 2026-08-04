-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "materials" TEXT[],
ADD COLUMN     "safetyNotes" TEXT,
ADD COLUMN     "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "videoUrl" TEXT;

-- AlterTable
ALTER TABLE "recipe_ingredients" ADD COLUMN     "unit" "ItemUnit";

-- AlterTable
ALTER TABLE "recipes" ADD COLUMN     "allergens" TEXT[],
ADD COLUMN     "childPreferenceTags" TEXT[],
ADD COLUMN     "cookingTips" TEXT,
ADD COLUMN     "shortDescription" TEXT,
ADD COLUMN     "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "videoUrl" TEXT;
