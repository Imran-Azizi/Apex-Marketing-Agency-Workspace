import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeEffectivePermissions,
  hasAnyPermission,
  permissionSatisfied,
} from '../../src/services/permissions/effective.js';
import {
  ALL_PERMISSION_CODES,
  ROLE_DEFAULT_PERMISSIONS,
  getGrantableCodes,
  isFullAccessRole,
} from '../../src/services/permissions/catalog.js';

test('admin and manager receive the full catalog', () => {
  const admin = computeEffectivePermissions({
    roleCode: 'ADMIN',
    rolePermissionCodes: [],
    overrides: [{ code: 'crm.view', granted: false }],
  });
  assert.equal(admin.length, ALL_PERMISSION_CODES.length);
  assert.equal(hasAnyPermission([], ['settings.permissions'], 'MANAGER'), true);
});

test('manager and admin are equivalent full-access grantors', () => {
  assert.equal(isFullAccessRole('MANAGER'), true);
  assert.equal(isFullAccessRole('ADMIN'), true);
  assert.equal(ALL_PERMISSION_CODES.includes('settings.permissions'), true);

  const managerGrantable = getGrantableCodes({ roleCode: 'MANAGER', permissions: [] });
  const adminGrantable = getGrantableCodes({ roleCode: 'ADMIN', permissions: [] });

  assert.equal(managerGrantable.size, ALL_PERMISSION_CODES.length);
  assert.equal(adminGrantable.size, ALL_PERMISSION_CODES.length);
  assert.equal(managerGrantable.has('settings.permissions'), true);
  assert.equal(adminGrantable.has('settings.permissions'), true);
});

test('staff cannot escalate beyond their own permissions', () => {
  const grantable = getGrantableCodes({
    roleCode: 'SALES',
    permissions: ['crm.view', 'crm.invite'],
  });
  assert.equal(grantable.has('crm.invite'), true);
  assert.equal(grantable.has('settings.permissions'), false);
  assert.equal(grantable.has('finance.approve'), false);
});

test('sales defaults include CRM write but not project delete or finance approve', () => {
  const codes = computeEffectivePermissions({
    roleCode: 'SALES',
    rolePermissionCodes: ROLE_DEFAULT_PERMISSIONS.SALES,
  });
  assert.equal(permissionSatisfied(codes, 'crm.create', 'SALES'), true);
  assert.equal(permissionSatisfied(codes, 'projects.view', 'SALES'), true);
  assert.equal(permissionSatisfied(codes, 'projects.delete', 'SALES'), false);
  assert.equal(permissionSatisfied(codes, 'finance.approve', 'SALES'), false);
  assert.equal(permissionSatisfied(codes, 'employees.view', 'SALES'), false);
});

test('user grants and revokes override role defaults', () => {
  const codes = computeEffectivePermissions({
    roleCode: 'SALES',
    rolePermissionCodes: ROLE_DEFAULT_PERMISSIONS.SALES,
    overrides: [
      { code: 'projects.delete', granted: true },
      { code: 'crm.delete', granted: false },
    ],
  });
  assert.equal(permissionSatisfied(codes, 'projects.delete', 'SALES'), true);
  assert.equal(permissionSatisfied(codes, 'crm.delete', 'SALES'), false);
  assert.equal(permissionSatisfied(codes, 'crm.view', 'SALES'), true);
});

test('editor project:read legacy does not unlock manager projects.view', () => {
  const codes = computeEffectivePermissions({
    roleCode: 'EDITOR',
    rolePermissionCodes: ['dashboard:view', 'project:read', 'production:upload'],
  });
  assert.equal(permissionSatisfied(codes, 'video.view', 'EDITOR'), true);
  assert.equal(permissionSatisfied(codes, 'projects.view', 'EDITOR'), false);
});

test('sales legacy project:read still satisfies projects.view during rollout', () => {
  const codes = computeEffectivePermissions({
    roleCode: 'SALES',
    rolePermissionCodes: ['project:read', 'crm:write'],
  });
  assert.equal(permissionSatisfied(codes, 'projects.view', 'SALES'), true);
  assert.equal(permissionSatisfied(codes, 'crm.create', 'SALES'), true);
});

test('editor defaults keep production workflow without manager modules', () => {
  const codes = computeEffectivePermissions({
    roleCode: 'EDITOR',
    rolePermissionCodes: ROLE_DEFAULT_PERMISSIONS.EDITOR,
  });
  assert.equal(hasAnyPermission(codes, ['video.upload'], 'EDITOR'), true);
  assert.equal(hasAnyPermission(codes, ['projects.view'], 'EDITOR'), false);
  assert.equal(hasAnyPermission(codes, ['content.generate'], 'EDITOR'), false);
});

test('narrator defaults keep voice upload only', () => {
  const codes = computeEffectivePermissions({
    roleCode: 'NARRATOR',
    rolePermissionCodes: ROLE_DEFAULT_PERMISSIONS.NARRATOR,
  });
  assert.equal(hasAnyPermission(codes, ['narration.upload'], 'NARRATOR'), true);
  assert.equal(hasAnyPermission(codes, ['narration.approve'], 'NARRATOR'), false);
  assert.equal(hasAnyPermission(codes, ['projects.view'], 'NARRATOR'), false);
});
