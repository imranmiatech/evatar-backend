/*
  Warnings:

  - You are about to drop the column `assignmentId` on the `care_quiz_answers` table. All the data in the column will be lost.
  - You are about to drop the `care_module_assignments` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[progressId,questionId]` on the table `care_quiz_answers` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `progressId` to the `care_quiz_answers` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CareModuleProgressStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- DropForeignKey
ALTER TABLE "care_module_assignments" DROP CONSTRAINT "care_module_assignments_assignedByUserId_fkey";

-- DropForeignKey
ALTER TABLE "care_module_assignments" DROP CONSTRAINT "care_module_assignments_childId_fkey";

-- DropForeignKey
ALTER TABLE "care_module_assignments" DROP CONSTRAINT "care_module_assignments_moduleId_fkey";

-- DropForeignKey
ALTER TABLE "care_module_assignments" DROP CONSTRAINT "care_module_assignments_nannyUserId_fkey";

-- DropForeignKey
ALTER TABLE "care_quiz_answers" DROP CONSTRAINT "care_quiz_answers_assignmentId_fkey";

-- DropIndex
DROP INDEX "care_quiz_answers_assignmentId_idx";

-- DropIndex
DROP INDEX "care_quiz_answers_assignmentId_questionId_key";

-- AlterTable
ALTER TABLE "care_quiz_answers" DROP COLUMN "assignmentId",
ADD COLUMN     "progressId" TEXT NOT NULL;

-- DropTable
DROP TABLE "care_module_assignments";

-- DropEnum
DROP TYPE "CareModuleAssignmentStatus";

-- CreateTable
CREATE TABLE "care_module_progress" (
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
CREATE INDEX "care_module_progress_userId_status_createdAt_idx" ON "care_module_progress"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "care_module_progress_childId_status_idx" ON "care_module_progress"("childId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "care_module_progress_moduleId_childId_userId_key" ON "care_module_progress"("moduleId", "childId", "userId");

-- CreateIndex
CREATE INDEX "care_quiz_answers_progressId_idx" ON "care_quiz_answers"("progressId");

-- CreateIndex
CREATE UNIQUE INDEX "care_quiz_answers_progressId_questionId_key" ON "care_quiz_answers"("progressId", "questionId");

-- AddForeignKey
ALTER TABLE "care_module_progress" ADD CONSTRAINT "care_module_progress_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_module_progress" ADD CONSTRAINT "care_module_progress_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "care_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_module_progress" ADD CONSTRAINT "care_module_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_quiz_answers" ADD CONSTRAINT "care_quiz_answers_progressId_fkey" FOREIGN KEY ("progressId") REFERENCES "care_module_progress"("id") ON DELETE CASCADE ON UPDATE CASCADE;
