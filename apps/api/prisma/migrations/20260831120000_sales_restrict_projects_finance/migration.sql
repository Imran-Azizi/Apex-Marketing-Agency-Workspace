-- Restrict SALES role: remove projects and finance panel access by default.
-- Admins may grant canonical codes per-user via Settings if needed.

DELETE FROM "role_permissions" rp
USING "roles" r, "permissions" p
WHERE rp."roleId" = r.id
  AND rp."permissionId" = p.id
  AND r.code = 'SALES'
  AND p.code IN (
    'projects.view',
    'finance.view',
    'finance.create',
    'finance.edit',
    'finance.delete',
    'project:read',
    'finance:read',
    'finance:write'
  );
