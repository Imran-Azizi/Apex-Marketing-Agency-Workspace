import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeEffectivePermissions,
  hasAnyPermission,
  permissionSatisfied,
  canAssignProjectEditor,
  canReviewProjectPosters,
  canSendProjectPosters,
  canReviewFinalVideos,
  canSendFinalVideos,
} from '../../src/services/permissions/effective.js';
import {
  ALL_PERMISSION_CODES,
  ROLE_DEFAULT_PERMISSIONS,
  getGrantableCodes,
  isFullAccessRole,
  isManageableStaffRole,
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
  assert.equal(ALL_PERMISSION_CODES.includes('crm.portal_credentials'), true);

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

test('sales defaults include CRM write but not projects, finance, or finance approve', () => {
  const codes = computeEffectivePermissions({
    roleCode: 'SALES',
    rolePermissionCodes: ROLE_DEFAULT_PERMISSIONS.SALES,
  });
  assert.equal(permissionSatisfied(codes, 'crm.create', 'SALES'), true);
  assert.equal(permissionSatisfied(codes, 'crm.invite', 'SALES'), true);
  assert.equal(permissionSatisfied(codes, 'crm.portal_credentials', 'SALES'), false);
  assert.equal(permissionSatisfied(codes, 'projects.view', 'SALES'), false);
  assert.equal(permissionSatisfied(codes, 'projects.delete', 'SALES'), false);
  assert.equal(permissionSatisfied(codes, 'finance.view', 'SALES'), false);
  assert.equal(permissionSatisfied(codes, 'finance.create', 'SALES'), false);
  assert.equal(permissionSatisfied(codes, 'finance.approve', 'SALES'), false);
  assert.equal(permissionSatisfied(codes, 'employees.view', 'SALES'), false);
  assert.equal(permissionSatisfied(codes, 'sales_assistant.view', 'SALES'), true);
  assert.equal(permissionSatisfied(codes, 'sales_assistant.act', 'SALES'), true);
  assert.equal(permissionSatisfied(codes, 'sales_assistant.manage', 'SALES'), true);
  assert.equal(permissionSatisfied(codes, 'crm.opportunity', 'SALES'), true);
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

test('sales legacy project:read and finance:read do not unlock restricted modules', () => {
  const codes = computeEffectivePermissions({
    roleCode: 'SALES',
    rolePermissionCodes: [
      ...ROLE_DEFAULT_PERMISSIONS.SALES,
      'project:read',
      'finance:read',
      'finance:write',
    ],
  });
  assert.equal(permissionSatisfied(codes, 'projects.view', 'SALES'), false);
  assert.equal(permissionSatisfied(codes, 'finance.view', 'SALES'), false);
  assert.equal(permissionSatisfied(codes, 'crm.create', 'SALES'), true);
});

test('editor cannot assign a project editor even if projects.assign was granted', () => {
  const codes = computeEffectivePermissions({
    roleCode: 'EDITOR',
    rolePermissionCodes: [...ROLE_DEFAULT_PERMISSIONS.EDITOR, 'projects.assign'],
  });
  assert.equal(hasAnyPermission(codes, ['projects.assign'], 'EDITOR'), true);
  assert.equal(canAssignProjectEditor(codes, 'EDITOR'), false);
  assert.equal(canAssignProjectEditor(codes, 'MANAGER'), true);
});

test('editor cannot approve or send posters even if those codes were granted', () => {
  const codes = computeEffectivePermissions({
    roleCode: 'EDITOR',
    rolePermissionCodes: [
      ...ROLE_DEFAULT_PERMISSIONS.EDITOR,
      'poster.approve',
      'poster.send',
      'video.approve',
    ],
  });
  assert.equal(hasAnyPermission(codes, ['poster.approve'], 'EDITOR'), true);
  assert.equal(canReviewProjectPosters(codes, 'EDITOR'), false);
  assert.equal(canSendProjectPosters(codes, 'EDITOR'), false);
  assert.equal(canReviewProjectPosters(codes, 'MANAGER'), true);
  assert.equal(canSendProjectPosters([], 'MANAGER'), true);
  assert.equal(canReviewProjectPosters([], 'ADMIN'), true);
  assert.equal(canReviewProjectPosters(codes, 'PROJECT_MANAGER'), false);
});

test('editor cannot approve or send final videos even if those codes were granted', () => {
  const codes = computeEffectivePermissions({
    roleCode: 'EDITOR',
    rolePermissionCodes: [
      ...ROLE_DEFAULT_PERMISSIONS.EDITOR,
      'video.approve',
      'video.send',
    ],
  });
  assert.equal(hasAnyPermission(codes, ['video.approve'], 'EDITOR'), true);
  assert.equal(canReviewFinalVideos(codes, 'EDITOR'), false);
  assert.equal(canSendFinalVideos(codes, 'EDITOR'), false);
  assert.equal(canReviewFinalVideos(codes, 'MANAGER'), true);
  assert.equal(canSendFinalVideos([], 'MANAGER'), true);
  assert.equal(canReviewFinalVideos([], 'ADMIN'), true);
  assert.equal(canSendFinalVideos(codes, 'PROJECT_MANAGER'), false);
});

test('editor defaults keep production workflow without manager modules', () => {
  const codes = computeEffectivePermissions({
    roleCode: 'EDITOR',
    rolePermissionCodes: ROLE_DEFAULT_PERMISSIONS.EDITOR,
  });
  assert.equal(hasAnyPermission(codes, ['video.upload'], 'EDITOR'), true);
  assert.equal(hasAnyPermission(codes, ['poster.upload'], 'EDITOR'), true);
  assert.equal(hasAnyPermission(codes, ['poster.approve'], 'EDITOR'), false);
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

test('finance defaults exclude CRM and projects but keep finance modules', () => {
  const codes = computeEffectivePermissions({
    roleCode: 'FINANCE',
    rolePermissionCodes: ROLE_DEFAULT_PERMISSIONS.FINANCE,
  });
  assert.equal(permissionSatisfied(codes, 'finance.view', 'FINANCE'), true);
  assert.equal(permissionSatisfied(codes, 'finance.create', 'FINANCE'), true);
  assert.equal(permissionSatisfied(codes, 'finance.edit', 'FINANCE'), true);
  assert.equal(permissionSatisfied(codes, 'finance.delete', 'FINANCE'), true);
  assert.equal(permissionSatisfied(codes, 'delivery.view', 'FINANCE'), true);
  assert.equal(permissionSatisfied(codes, 'audit.view', 'FINANCE'), true);
  assert.equal(permissionSatisfied(codes, 'crm.view', 'FINANCE'), false);
  assert.equal(permissionSatisfied(codes, 'projects.view', 'FINANCE'), false);
});

test('finance legacy crm:read and project:read do not expand to module access', () => {
  const codes = computeEffectivePermissions({
    roleCode: 'FINANCE',
    rolePermissionCodes: [
      ...ROLE_DEFAULT_PERMISSIONS.FINANCE,
      'crm:read',
      'project:read',
    ],
  });
  assert.equal(permissionSatisfied(codes, 'crm.view', 'FINANCE'), false);
  assert.equal(permissionSatisfied(codes, 'projects.view', 'FINANCE'), false);
  assert.equal(permissionSatisfied(codes, 'finance.view', 'FINANCE'), true);
});

test('project manager defaults focus on projects and chat, not CRM or finance', () => {
  const codes = computeEffectivePermissions({
    roleCode: 'PROJECT_MANAGER',
    rolePermissionCodes: ROLE_DEFAULT_PERMISSIONS.PROJECT_MANAGER,
  });
  assert.equal(permissionSatisfied(codes, 'dashboard.view', 'PROJECT_MANAGER'), true);
  assert.equal(permissionSatisfied(codes, 'projects.view', 'PROJECT_MANAGER'), true);
  assert.equal(permissionSatisfied(codes, 'projects.edit', 'PROJECT_MANAGER'), true);
  assert.equal(permissionSatisfied(codes, 'projects.assign', 'PROJECT_MANAGER'), true);
  assert.equal(permissionSatisfied(codes, 'projects.complete', 'PROJECT_MANAGER'), true);
  assert.equal(permissionSatisfied(codes, 'content.view', 'PROJECT_MANAGER'), true);
  assert.equal(permissionSatisfied(codes, 'chat.view', 'PROJECT_MANAGER'), true);
  assert.equal(permissionSatisfied(codes, 'crm.view', 'PROJECT_MANAGER'), false);
  assert.equal(permissionSatisfied(codes, 'finance.view', 'PROJECT_MANAGER'), false);
  assert.equal(permissionSatisfied(codes, 'employees.view', 'PROJECT_MANAGER'), false);
  assert.equal(permissionSatisfied(codes, 'settings.view', 'PROJECT_MANAGER'), false);
  assert.equal(isManageableStaffRole('PROJECT_MANAGER'), true);
});
