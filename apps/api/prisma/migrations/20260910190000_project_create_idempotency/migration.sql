-- Idempotency key so duplicate project-create submits reuse one project.
-- Multiple NULLs remain allowed (legacy / non-wizard clients).

ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "createIdempotencyKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "projects_createIdempotencyKey_key"
  ON "projects"("createIdempotencyKey");
