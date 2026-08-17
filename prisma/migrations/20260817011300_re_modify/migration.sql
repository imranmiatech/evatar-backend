/*
  Warnings:

  - You are about to drop the column `childId` on the `care_module_progress` table. All the data in the column will be lost.
  - You are about to drop the column `childId` on the `care_module_saves` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[moduleId,userId]` on the table `care_module_progress` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[moduleId,userId]` on the table `care_module_saves` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "care_module_progress" DROP CONSTRAINT "care_module_progress_childId_fkey";

-- DropForeignKey
ALTER TABLE "care_module_saves" DROP CONSTRAINT "care_module_saves_childId_fkey";

-- DropIndex
DROP INDEX "care_module_progress_childId_status_idx";

-- DropIndex
DROP INDEX "care_module_progress_moduleId_childId_userId_key";

-- DropIndex
DROP INDEX "care_module_saves_childId_idx";

-- DropIndex
DROP INDEX "care_module_saves_moduleId_userId_childId_key";

-- DropIndex
DROP INDEX "care_module_saves_userId_childId_createdAt_idx";

-- AlterTable
ALTER TABLE "care_module_progress" DROP COLUMN "childId";

-- AlterTable
ALTER TABLE "care_module_saves" DROP COLUMN "childId";

-- CreateIndex
CREATE UNIQUE INDEX "care_module_progress_moduleId_userId_key" ON "care_module_progress"("moduleId", "userId");

-- CreateIndex
CREATE INDEX "care_module_saves_userId_createdAt_idx" ON "care_module_saves"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "care_module_saves_moduleId_userId_key" ON "care_module_saves"("moduleId", "userId");
