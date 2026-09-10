import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { SECURITY } from '../config/security.js';

const VERIFY_OPTS = {
  algorithms: [...SECURITY.jwt.algorithms],
  clockTolerance: SECURITY.jwt.clockToleranceSec,
};

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

export function signAccessToken(payload) {
  return jwt.sign(payload, env.jwtAccessSecret, {
    expiresIn: env.jwtAccessExpires,
    algorithm: 'HS256',
  });
}

export function signRefreshToken(payload) {
  return jwt.sign(payload, env.jwtRefreshSecret, {
    expiresIn: env.jwtRefreshExpires,
    algorithm: 'HS256',
  });
}

function assertKnownAudience(payload) {
  if (payload?.aud !== 'INTERNAL' && payload?.aud !== 'PORTAL') {
    throw new Error('Invalid token audience');
  }
  return payload;
}

export function verifyAccessToken(token) {
  const payload = jwt.verify(token, env.jwtAccessSecret, VERIFY_OPTS);
  return assertKnownAudience(payload);
}

export function verifyRefreshToken(token) {
  const payload = jwt.verify(token, env.jwtRefreshSecret, VERIFY_OPTS);
  return assertKnownAudience(payload);
}

export function generateOtp(length = 6) {
  const max = 10 ** length;
  const num = crypto.randomInt(0, max);
  return String(num).padStart(length, '0');
}

export function signDownloadToken(payload, ttlSeconds = env.signedUrlTtl) {
  return jwt.sign(payload, env.signedUrlSecret, {
    expiresIn: ttlSeconds,
    algorithm: 'HS256',
  });
}

export function verifyDownloadToken(token) {
  return jwt.verify(token, env.signedUrlSecret, VERIFY_OPTS);
}
