-- Project managers are regular staff for Tasks / Knowledge / Policies.
-- Revoke elevated create/manage defaults; managers can re-grant per user in Settings.
DELETE FROM "role_permissions" rp
USING "roles" r, "permissions" p
WHERE rp."roleId" = r.id
  AND rp."permissionId" = p.id
  AND r.code = 'PROJECT_MANAGER'
  AND p.code IN (
    'tasks.create',
    'tasks.edit',
    'tasks.manage',
    'knowledge.manage'
  );
