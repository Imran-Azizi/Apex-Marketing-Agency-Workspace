import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_PERMISSION_CODES,
  ROLE_DEFAULT_PERMISSIONS,
} from '../../src/services/permissions/catalog.js';
import { permissionSatisfied } from '../../src/services/permissions/effective.js';
import {
  createKnowledgeSchema,
  updateKnowledgeSchema,
} from '../../src/modules/knowledge/service.js';

test('knowledge permission codes exist in catalog', () => {
  for (const code of [
    'knowledge.view',
    'knowledge.create',
    'knowledge.edit',
    'knowledge.manage',
    'knowledge.delete',
  ]) {
    assert.equal(ALL_PERMISSION_CODES.includes(code), true, code);
  }
});

test('staff including project managers can share peer knowledge; policy manage is not default', () => {
  for (const role of [
    'EDITOR',
    'NARRATOR',
    'SALES',
    'FINANCE',
    'PROJECT_MANAGER',
  ]) {
    assert.equal(
      permissionSatisfied(ROLE_DEFAULT_PERMISSIONS[role], 'knowledge.view', role),
      true,
      role,
    );
    assert.equal(
      permissionSatisfied(ROLE_DEFAULT_PERMISSIONS[role], 'knowledge.create', role),
      true,
      role,
    );
    assert.equal(
      permissionSatisfied(ROLE_DEFAULT_PERMISSIONS[role], 'knowledge.manage', role),
      false,
      role,
    );
  }
});

test('createKnowledgeSchema validates experience and policy payloads', () => {
  const ok = createKnowledgeSchema.parse({
    title: 'گردش‌کار ادیت رنگ',
    body: 'از ایمپورت تا اکسپورت',
    steps: [{ title: 'ایمپورت', body: 'فایل را وارد کنید' }],
    publish: true,
  });
  assert.equal(ok.title, 'گردش‌کار ادیت رنگ');
  assert.equal(ok.kind, 'EXPERIENCE');
  assert.equal(ok.steps.length, 1);

  const policy = createKnowledgeSchema.parse({
    kind: 'POLICY',
    title: 'استاندارد ادیت',
    roleAudience: 'EDITOR',
    publish: true,
  });
  assert.equal(policy.kind, 'POLICY');
  assert.equal(policy.roleAudience, 'EDITOR');

  assert.throws(() => createKnowledgeSchema.parse({ title: 'a' }));
});

test('updateKnowledgeSchema requires at least one field', () => {
  assert.throws(() => updateKnowledgeSchema.parse({}));
  const updated = updateKnowledgeSchema.parse({ title: 'عنوان جدید' });
  assert.equal(updated.title, 'عنوان جدید');
});
