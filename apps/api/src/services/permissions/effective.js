import {
  ALL_PERMISSION_CODES,
  LEGACY_CODE_MAP,
  getRoleDefaultPermissions,
  isFullAccessRole,
} from "./catalog.js";

const CANONICAL_FROM_LEGACY = LEGACY_CODE_MAP;

const LEGACY_FROM_CANONICAL = (() => {
  const map = new Map();
  for (const [legacy, canons] of Object.entries(CANONICAL_FROM_LEGACY)) {
    for (const code of canons) {
      const list = map.get(code) || [];
      list.push(legacy);
      map.set(code, list);
    }
  }
  return map;
})();

/**
 * Editors/narrators historically had project:read for their own task APIs.
 * That must not unlock the manager projects module during rollout.
 */
function skipLegacyExpand(legacyCode, roleCode) {
  return (
    legacyCode === "project:read" &&
    (roleCode === "EDITOR" || roleCode === "NARRATOR")
  );
}

export function expandLegacyCodes(codes = [], roleCode) {
  const out = new Set(codes);
  for (const code of codes) {
    if (skipLegacyExpand(code, roleCode)) continue;
    const mapped = CANONICAL_FROM_LEGACY[code];
    if (mapped) {
      for (const item of mapped) out.add(item);
    }
  }
  return out;
}

export function computeEffectivePermissions({
  roleCode,
  rolePermissionCodes = [],
  overrides = [],
}) {
  if (isFullAccessRole(roleCode)) {
    return [...ALL_PERMISSION_CODES];
  }

  const effective = expandLegacyCodes(rolePermissionCodes, roleCode);
  for (const row of overrides) {
    if (!row?.code) continue;
    if (row.granted) effective.add(row.code);
    else effective.delete(row.code);
  }
  return [...effective];
}

export function permissionSatisfied(effectiveCodes, requiredCode, roleCode) {
  if (isFullAccessRole(roleCode)) return true;
  if (!requiredCode) return true;

  const set = expandLegacyCodes(effectiveCodes, roleCode);
  if (set.has(requiredCode)) return true;

  const mapped = CANONICAL_FROM_LEGACY[requiredCode];
  if (mapped?.some((code) => set.has(code))) return true;

  const reverse = LEGACY_FROM_CANONICAL.get(requiredCode) || [];
  for (const legacy of reverse) {
    if (skipLegacyExpand(legacy, roleCode)) continue;
    if (set.has(legacy)) return true;
  }
  return false;
}

export function hasAnyPermission(effectiveCodes, requiredCodes, roleCode) {
  if (isFullAccessRole(roleCode)) return true;
  if (!requiredCodes?.length) return true;
  return requiredCodes.some((code) =>
    permissionSatisfied(effectiveCodes, code, roleCode),
  );
}

export function loadOverridesFromUser(user) {
  return (user?.userPermissions || []).map((row) => ({
    code: row.permission?.code,
    granted: row.granted,
  }));
}

export function loadRoleCodesFromUser(user) {
  return (user?.role?.permissions || []).map((row) => row.permission.code);
}

export function effectiveFromUser(user) {
  return computeEffectivePermissions({
    roleCode: user?.role?.code || user?.roleCode,
    rolePermissionCodes: loadRoleCodesFromUser(user),
    overrides: loadOverridesFromUser(user),
  });
}

export function diffPermissionSets(previous = [], next = []) {
  const prev = new Set(previous);
  const upcoming = new Set(next);
  const added = [...upcoming].filter((code) => !prev.has(code));
  const removed = [...prev].filter((code) => !upcoming.has(code));
  return { added, removed };
}

export function catalogCodesSet() {
  return new Set(ALL_PERMISSION_CODES);
}

export function roleDefaultsFor(roleCode) {
  return getRoleDefaultPermissions(roleCode);
}
