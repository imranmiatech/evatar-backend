/*
  Warnings:

  - You are about to drop the column `assignmentId` on the `care_quiz_answers` table. All the data in the column will be lost.
  - You are about to drop the `care_module_assignments` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[progressId,questionId]` on the table `care_quiz_answers` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `progressId` to the `care_quiz_answers` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "CareModuleProgressStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey
ALTER TABLE IF EXISTS "care_module_assignments" DROP CONSTRAINT IF EXISTS "care_module_assignments_assignedByUserId_fkey";
ALTER TABLE IF EXISTS "care_module_assignments" DROP CONSTRAINT IF EXISTS "care_module_assignments_childId_fkey";
ALTER TABLE IF EXISTS "care_module_assignments" DROP CONSTRAINT IF EXISTS "care_module_assignments_moduleId_fkey";
ALTER TABLE IF EXISTS "care_module_assignments" DROP CONSTRAINT IF EXISTS "care_module_assignments_nannyUserId_fkey";
ALTER TABLE IF EXISTS "care_quiz_answers" DROP CONSTRAINT IF EXISTS "care_quiz_answers_assignmentId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "care_quiz_answers_assignmentId_idx";
DROP INDEX IF EXISTS "care_quiz_answers_assignmentId_questionId_key";

-- AlterTable
DELETE FROM "care_quiz_answers";
ALTER TABLE "care_quiz_answers" DROP COLUMN IF EXISTS "assignmentId";
ALTER TABLE "care_quiz_answers" ADD COLUMN IF NOT EXISTS "progressId" TEXT NOT NULL;

-- DropTable
DROP TABLE IF EXISTS "care_module_assignments";

-- DropEnum
DROP TYPE IF EXISTS "CareModuleAssignmentStatus";

-- CreateTable
CREATE TABLE IF NOT EXISTS "care_module_progress" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "CareModuleProgressStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "score" INTEGER,
    "totalQuestions" INTEGER,
    "correctAnswers" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "pointsEarned" INTEGER NOT NULL DEFAULT 0,
    "pointsAwardedAt" TIMESTAMP(3),

    CONSTRAINT "care_module_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "care_module_progress_userId_status_createdAt_idx" ON "care_module_progress"("userId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "care_module_progress_childId_status_idx" ON "care_module_progress"("childId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "care_module_progress_moduleId_childId_userId_key" ON "care_module_progress"("moduleId", "childId", "userId");
CREATE INDEX IF NOT EXISTS "care_quiz_answers_progressId_idx" ON "care_quiz_answers"("progressId");
CREATE UNIQUE INDEX IF NOT EXISTS "care_quiz_answers_progressId_questionId_key" ON "care_quiz_answers"("progressId", "questionId");

-- AddForeignKey
ALTER TABLE "care_module_progress" DROP CONSTRAINT IF EXISTS "care_module_progress_childId_fkey";
ALTER TABLE "care_module_progress" ADD CONSTRAINT "care_module_progress_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "care_module_progress" DROP CONSTRAINT IF EXISTS "care_module_progress_moduleId_fkey";
ALTER TABLE "care_module_progress" ADD CONSTRAINT "care_module_progress_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "care_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "care_module_progress" DROP CONSTRAINT IF EXISTS "care_module_progress_userId_fkey";
ALTER TABLE "care_module_progress" ADD CONSTRAINT "care_module_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "care_quiz_answers" DROP CONSTRAINT IF EXISTS "care_quiz_answers_progressId_fkey";
ALTER TABLE "care_quiz_answers" ADD CONSTRAINT "care_quiz_answers_progressId_fkey" FOREIGN KEY ("progressId") REFERENCES "care_module_progress"("id") ON DELETE CASCADE ON UPDATE CASCADE;
