import { AppError } from '../utils/response.js';
import { isFullAccessRole } from '../services/permissions/catalog.js';
import { hasAnyPermission } from '../services/permissions/effective.js';

export function hasFullAccess(roleCode) {
  return isFullAccessRole(roleCode);
}

export function can(req, ...codes) {
  if (!req?.auth) return false;
  return hasAnyPermission(req.auth.permissions, codes, req.auth.roleCode);
}

export function requirePermission(...codes) {
  return (req, res, next) => {
    if (!req.auth) return next(new AppError('Authentication required', 401, 'UNAUTHENTICATED'));
    if (hasAnyPermission(req.auth.permissions, codes, req.auth.roleCode)) return next();
    return next(new AppError('شما اجازه دسترسی به این منبع را ندارید', 403, 'FORBIDDEN'));
  };
}

export function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.auth) return next(new AppError('Authentication required', 401, 'UNAUTHENTICATED'));
    if (!roles.includes(req.auth.roleCode)) {
      return next(new AppError('نقش شما اجازه دسترسی به این بخش را ندارد', 403, 'FORBIDDEN'));
    }
    next();
  };
}

export function denyRoles(...roles) {
  const blocked = new Set(roles);
  return (req, res, next) => {
    if (!req.auth) return next(new AppError('Authentication required', 401, 'UNAUTHENTICATED'));
    if (blocked.has(req.auth.roleCode)) {
      return next(new AppError('دسترسی به این منبع برای نقش شما مجاز نیست', 403, 'FORBIDDEN'));
    }
    next();
  };
}

export function requireInternal(req, res, next) {
  if (!req.auth || req.auth.audience !== 'INTERNAL') {
    return next(new AppError('Internal access only', 403, 'FORBIDDEN'));
  }
  next();
}

export function requirePortal(req, res, next) {
  if (!req.auth || req.auth.audience !== 'PORTAL') {
    return next(new AppError('Portal access only', 403, 'FORBIDDEN'));
  }
  next();
}
