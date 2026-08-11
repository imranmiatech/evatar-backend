-- Scope saved care modules to a specific child.
ALTER TABLE "care_module_saves" ADD COLUMN "childId" TEXT;

DROP INDEX IF EXISTS "care_module_saves_moduleId_userId_key";
DROP INDEX IF EXISTS "care_module_saves_userId_createdAt_idx";

CREATE UNIQUE INDEX "care_module_saves_moduleId_userId_childId_key" ON "care_module_saves"("moduleId", "userId", "childId");
CREATE INDEX "care_module_saves_userId_childId_createdAt_idx" ON "care_module_saves"("userId", "childId", "createdAt");
CREATE INDEX "care_module_saves_childId_idx" ON "care_module_saves"("childId");

ALTER TABLE "care_module_saves" ADD CONSTRAINT "care_module_saves_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;
