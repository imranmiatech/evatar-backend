-- CreateTable
CREATE TABLE "care_child_notes" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "care_child_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "care_child_notes_childId_createdAt_idx" ON "care_child_notes"("childId", "createdAt");

-- CreateIndex
CREATE INDEX "care_child_notes_authorUserId_createdAt_idx" ON "care_child_notes"("authorUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "care_child_notes" ADD CONSTRAINT "care_child_notes_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_child_notes" ADD CONSTRAINT "care_child_notes_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
