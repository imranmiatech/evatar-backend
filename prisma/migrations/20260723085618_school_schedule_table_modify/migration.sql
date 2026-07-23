/*
  Warnings:

  - A unique constraint covering the columns `[childId]` on the table `SchoolSchedule` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "SchoolSchedule_childId_key" ON "SchoolSchedule"("childId");
