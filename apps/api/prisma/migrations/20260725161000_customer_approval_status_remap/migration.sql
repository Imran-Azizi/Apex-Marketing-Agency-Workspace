-- Remap existing published versions into the new approval workflow statuses
UPDATE "content_versions" AS cv
SET status = 'PENDING_CUSTOMER_APPROVAL'
FROM "projects" AS p
WHERE cv."projectId" = p.id
  AND cv."publishedToClient" = true
  AND cv.status = 'APPROVED'
  AND p.status = 'WAITING_CLIENT_CONTENT_APPROVAL';

UPDATE "content_versions" AS cv
SET status = 'REVISION_REQUESTED'
FROM "projects" AS p
WHERE cv."projectId" = p.id
  AND cv."publishedToClient" = true
  AND cv.status IN ('APPROVED', 'PENDING_CUSTOMER_APPROVAL')
  AND p.status = 'CONTENT_REVISION';
