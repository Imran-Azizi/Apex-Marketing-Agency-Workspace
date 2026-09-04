-- FINANCE role still had legacy codes that expand to crm.view / projects.view
-- via permissionSatisfied() legacy mapping (crm:read, project:read).

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
