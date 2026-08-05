/*
  Warnings:

  - You are about to drop the column `materials` on the `activities` table. All the data in the column will be lost.
  - You are about to drop the column `safetyNotes` on the `activities` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `activities` table. All the data in the column will be lost.
  - You are about to drop the column `videoUrl` on the `activities` table. All the data in the column will be lost.
  - You are about to drop the column `unit` on the `recipe_ingredients` table. All the data in the column will be lost.
  - You are about to drop the column `allergens` on the `recipes` table. All the data in the column will be lost.
  - You are about to drop the column `childPreferenceTags` on the `recipes` table. All the data in the column will be lost.
  - You are about to drop the column `cookingTips` on the `recipes` table. All the data in the column will be lost.
  - You are about to drop the column `shortDescription` on the `recipes` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `recipes` table. All the data in the column will be lost.
  - You are about to drop the column `videoUrl` on the `recipes` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "activities" DROP COLUMN "materials",
DROP COLUMN "safetyNotes",
DROP COLUMN "status",
DROP COLUMN "videoUrl";

-- AlterTable
ALTER TABLE "recipe_ingredients" DROP COLUMN "unit";

-- AlterTable
ALTER TABLE "recipes" DROP COLUMN "allergens",
DROP COLUMN "childPreferenceTags",
DROP COLUMN "cookingTips",
DROP COLUMN "shortDescription",
DROP COLUMN "status",
DROP COLUMN "videoUrl";

-- DropEnum
DROP TYPE "ContentStatus";
