import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_PERMISSION_CODES,
  ROLE_DEFAULT_PERMISSIONS,
} from '../../src/services/permissions/catalog.js';
import { permissionSatisfied } from '../../src/services/permissions/effective.js';
import {
  createTaskSchema,
  updateTaskSchema,
  issueSchema,
  rejectSchema,
} from '../../src/modules/tasks/service.js';
import {
  buildTaskAssignedNotification,
  buildTaskDeadlineReminderNotification,
  buildTaskOverdueNotification,
  buildTaskStatusNotification,
} from '../../src/modules/tasks/notifications.js';
import { TASK_PRIORITIES, TASK_STATUSES } from '../../src/modules/tasks/constants.js';

test('tasks permission codes exist in catalog', () => {
  for (const code of [
    'tasks.view',
    'tasks.create',
    'tasks.edit',
    'tasks.manage',
    'tasks.delete',
  ]) {
    assert.equal(ALL_PERMISSION_CODES.includes(code), true, code);
  }
});

test('staff roles including project managers can view tasks by default but not create', () => {
  for (const role of [
    'SALES',
    'EDITOR',
    'NARRATOR',
    'FINANCE',
    'PROJECT_MANAGER',
  ]) {
    assert.equal(
      permissionSatisfied(ROLE_DEFAULT_PERMISSIONS[role], 'tasks.view', role),
      true,
      role,
    );
    assert.equal(
      permissionSatisfied(ROLE_DEFAULT_PERMISSIONS[role], 'tasks.create', role),
      false,
      role,
    );
    assert.equal(
      permissionSatisfied(ROLE_DEFAULT_PERMISSIONS[role], 'tasks.manage', role),
      false,
      role,
    );
  }
});

test('createTaskSchema validates required fields and priorities', () => {
  const ok = createTaskSchema.parse({
    title: 'آپلود ویدیوها',
    assigneeId: 'user-1',
    priority: 'HIGH',
    deadline: '2026-10-21T18:00',
    description: 'آپلود در وبسایت',
  });
  assert.equal(ok.title, 'آپلود ویدیوها');
  assert.equal(ok.priority, 'HIGH');

  assert.throws(() => createTaskSchema.parse({ title: 'a', assigneeId: 'x', deadline: 'x' }));
  assert.throws(() =>
    createTaskSchema.parse({
      title: 'عنوان کامل',
      assigneeId: 'user-1',
      priority: 'CRITICAL',
      deadline: '2026-10-21T18:00',
    }),
  );
});

test('update and note schemas enforce constraints', () => {
  assert.throws(() => updateTaskSchema.parse({}));
  const updated = updateTaskSchema.parse({ title: 'عنوان جدید' });
  assert.equal(updated.title, 'عنوان جدید');

  assert.throws(() => issueSchema.parse({ note: 'a' }));
  assert.equal(issueSchema.parse({ note: 'مشکل دسترسی' }).note, 'مشکل دسترسی');
  assert.throws(() => rejectSchema.parse({ note: '' }));
});

test('task notification builders include stable event keys and Persian copy', () => {
  const task = {
    id: 'task-1',
    title: 'آپلود ویدیو',
    priority: 'URGENT',
    deadline: new Date('2026-10-21T12:00:00.000Z'),
    assigneeId: 'u2',
  };

  const assigned = buildTaskAssignedNotification({ task, assignedAt: new Date('2026-10-19T10:00:00.000Z') });
  assert.match(assigned.eventKey, /^task\.assigned:task-1:/);
  assert.equal(assigned.meta.type, 'TASK_ASSIGNED');
  assert.match(assigned.title, /وظیفه/);
  assert.equal(assigned.link, '/tasks/task-1');

  const status = buildTaskStatusNotification({
    task,
    actorName: 'علی',
    status: 'COMPLETED',
    eventSuffix: 'done',
    title: 'وظیفه تکمیل شد',
  });
  assert.equal(status.meta.type, 'TASK_STATUS_UPDATED');
  assert.match(status.body, /علی/);

  const reminder = buildTaskDeadlineReminderNotification({ task, dayKey: '2026-10-19' });
  assert.equal(reminder.eventKey, 'task.deadline:task-1:2026-10-19');
  assert.equal(reminder.meta.type, 'TASK_DEADLINE_REMINDER');

  const overdue = buildTaskOverdueNotification({ task, dayKey: '2026-10-20' });
  assert.equal(overdue.meta.type, 'TASK_OVERDUE');
});

test('task enums cover required priority and status values', () => {
  assert.deepEqual(TASK_PRIORITIES, ['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
  assert.ok(TASK_STATUSES.includes('PENDING'));
  assert.ok(TASK_STATUSES.includes('IN_PROGRESS'));
  assert.ok(TASK_STATUSES.includes('COMPLETED'));
  assert.ok(TASK_STATUSES.includes('APPROVED'));
  assert.ok(TASK_STATUSES.includes('ISSUE_REPORTED'));
});
