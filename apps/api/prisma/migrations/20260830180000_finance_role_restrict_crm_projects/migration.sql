-- Restrict FINANCE role defaults: remove CRM and projects panel access.
-- Admins can still grant crm.view / projects.view per employee via Settings.

DELETE FROM "role_permissions" rp
USING "roles" r, "permissions" p
WHERE rp."roleId" = r.id
  AND rp."permissionId" = p.id
  AND r.code = 'FINANCE'
  AND p.code IN (
    'crm.view',
    'projects.view',
    'crm:read',
    'project:read'
  );
