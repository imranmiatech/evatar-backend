/*
  Warnings:

  - You are about to drop the column `childId` on the `care_module_progress` table. All the data in the column will be lost.
  - You are about to drop the column `childId` on the `care_module_saves` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[moduleId,userId]` on the table `care_module_progress` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[moduleId,userId]` on the table `care_module_saves` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE IF EXISTS "care_module_progress" DROP CONSTRAINT IF EXISTS "care_module_progress_childId_fkey";
ALTER TABLE IF EXISTS "care_module_saves" DROP CONSTRAINT IF EXISTS "care_module_saves_childId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "care_module_progress_childId_status_idx";
DROP INDEX IF EXISTS "care_module_progress_moduleId_childId_userId_key";
DROP INDEX IF EXISTS "care_module_saves_childId_idx";
DROP INDEX IF EXISTS "care_module_saves_moduleId_userId_childId_key";
DROP INDEX IF EXISTS "care_module_saves_userId_childId_createdAt_idx";

-- AlterTable
ALTER TABLE "care_module_progress" DROP COLUMN IF EXISTS "childId";
ALTER TABLE "care_module_saves" DROP COLUMN IF EXISTS "childId";

-- Deduplicate duplicate saves and progress entries for (moduleId, userId)
DELETE FROM "care_module_saves" a
USING "care_module_saves" b
WHERE a.id > b.id
  AND a."moduleId" = b."moduleId"
  AND a."userId" = b."userId";

DELETE FROM "care_module_progress" a
USING "care_module_progress" b
WHERE a.id > b.id
  AND a."moduleId" = b."moduleId"
  AND a."userId" = b."userId";

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "care_module_progress_moduleId_userId_key" ON "care_module_progress"("moduleId", "userId");
CREATE INDEX IF NOT EXISTS "care_module_saves_userId_createdAt_idx" ON "care_module_saves"("userId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "care_module_saves_moduleId_userId_key" ON "care_module_saves"("moduleId", "userId");
