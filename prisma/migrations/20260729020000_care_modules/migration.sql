-- CreateEnum
CREATE TYPE "CareModuleCategory" AS ENUM ('FEEDING', 'SLEEP', 'BEHAVIOR');

-- CreateEnum
CREATE TYPE "CareModuleAssignmentStatus" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "CareQuestionType" AS ENUM ('SINGLE_CHOICE', 'TRUE_FALSE');

-- CreateTable
CREATE TABLE "care_modules" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT,
    "coverImageUrl" TEXT,
    "category" "CareModuleCategory" NOT NULL,
    "estimatedMinutes" INTEGER,
    "coinReward" INTEGER NOT NULL DEFAULT 0,
    "contentTitle" TEXT,
    "contentSections" JSONB NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "care_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_quiz_questions" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "type" "CareQuestionType" NOT NULL DEFAULT 'SINGLE_CHOICE',
    "explanation" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "care_quiz_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_quiz_options" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "care_quiz_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_module_assignments" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "nannyUserId" TEXT NOT NULL,
    "assignedByUserId" TEXT NOT NULL,
    "status" "CareModuleAssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "score" INTEGER,
    "totalQuestions" INTEGER,
    "correctAnswers" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "care_module_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_quiz_answers" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selectedOptionId" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "care_quiz_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_module_saves" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "care_module_saves_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "care_modules_category_isPublished_createdAt_idx" ON "care_modules"("category", "isPublished", "createdAt");

-- CreateIndex
CREATE INDEX "care_modules_isPublished_createdAt_idx" ON "care_modules"("isPublished", "createdAt");

-- CreateIndex
CREATE INDEX "care_quiz_questions_moduleId_sortOrder_idx" ON "care_quiz_questions"("moduleId", "sortOrder");

-- CreateIndex
CREATE INDEX "care_quiz_options_questionId_sortOrder_idx" ON "care_quiz_options"("questionId", "sortOrder");

-- CreateIndex
CREATE INDEX "care_module_assignments_nannyUserId_status_createdAt_idx" ON "care_module_assignments"("nannyUserId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "care_module_assignments_childId_status_idx" ON "care_module_assignments"("childId", "status");

-- CreateIndex
CREATE INDEX "care_module_assignments_assignedByUserId_createdAt_idx" ON "care_module_assignments"("assignedByUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "care_module_assignments_moduleId_childId_nannyUserId_key" ON "care_module_assignments"("moduleId", "childId", "nannyUserId");

-- CreateIndex
CREATE INDEX "care_quiz_answers_assignmentId_idx" ON "care_quiz_answers"("assignmentId");

-- CreateIndex
CREATE INDEX "care_quiz_answers_questionId_idx" ON "care_quiz_answers"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "care_quiz_answers_assignmentId_questionId_key" ON "care_quiz_answers"("assignmentId", "questionId");

-- CreateIndex
CREATE INDEX "care_module_saves_userId_createdAt_idx" ON "care_module_saves"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "care_module_saves_moduleId_userId_key" ON "care_module_saves"("moduleId", "userId");

-- AddForeignKey
ALTER TABLE "care_modules" ADD CONSTRAINT "care_modules_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_quiz_questions" ADD CONSTRAINT "care_quiz_questions_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "care_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_quiz_options" ADD CONSTRAINT "care_quiz_options_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "care_quiz_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_module_assignments" ADD CONSTRAINT "care_module_assignments_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "care_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_module_assignments" ADD CONSTRAINT "care_module_assignments_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_module_assignments" ADD CONSTRAINT "care_module_assignments_nannyUserId_fkey" FOREIGN KEY ("nannyUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_module_assignments" ADD CONSTRAINT "care_module_assignments_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_quiz_answers" ADD CONSTRAINT "care_quiz_answers_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "care_module_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_quiz_answers" ADD CONSTRAINT "care_quiz_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "care_quiz_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_quiz_answers" ADD CONSTRAINT "care_quiz_answers_selectedOptionId_fkey" FOREIGN KEY ("selectedOptionId") REFERENCES "care_quiz_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_module_saves" ADD CONSTRAINT "care_module_saves_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "care_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_module_saves" ADD CONSTRAINT "care_module_saves_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
