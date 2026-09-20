/**
 * Lightweight SVG sanitizer for Client Asset logo uploads.
 * Strips scriptable content while preserving visual markup for <img> display.
 * Does not require external dependencies.
 */

import { AppError } from '../../utils/response.js';

/** Hard cap so pathological SVG bombs do not saturate memory. */
export const SVG_MAX_BYTES = 2 * 1024 * 1024;

const BLOCKED_TAGS = [
  'script',
  'foreignobject',
  'iframe',
  'embed',
  'object',
  'applet',
  'audio',
  'video',
  'base',
  'link',
  'meta',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'option',
  'handler',
  'listener',
  'set',
  'animate',
  'animatetransform',
  'animatemotion',
  'animation',
];

/**
 * @param {string | Buffer} input
 * @returns {Buffer}
 */
export function sanitizeSvgContent(input) {
  const raw = Buffer.isBuffer(input) ? input : Buffer.from(String(input), 'utf8');
  if (!raw.length) {
    throw new AppError('فایل SVG خالی است', 400, 'INVALID_SVG');
  }
  if (raw.length > SVG_MAX_BYTES) {
    throw new AppError(
      'حجم فایل SVG بیش از حد مجاز است',
      400,
      'FILE_TOO_LARGE',
    );
  }

  // Reject binary-looking payloads pretending to be SVG.
  if (raw.includes(0)) {
    throw new AppError('فایل SVG نامعتبر است', 400, 'INVALID_SVG');
  }

  let svg = raw.toString('utf8');

  // Strip XML bomb / external entity declarations.
  svg = svg.replace(/<!DOCTYPE[\s\S]*?>/gi, '');
  svg = svg.replace(/<!ENTITY[\s\S]*?>/gi, '');
  svg = svg.replace(/<\?xml-stylesheet[\s\S]*?\?>/gi, '');

  if (!/<svg[\s>]/i.test(svg)) {
    throw new AppError('فایل SVG معتبر نیست', 400, 'INVALID_SVG');
  }

  for (const tag of BLOCKED_TAGS) {
    const paired = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, 'gi');
    const selfClosing = new RegExp(`<${tag}\\b[^>]*\\/?>`, 'gi');
    svg = svg.replace(paired, '');
    svg = svg.replace(selfClosing, '');
  }

  // Event handlers: onclick, onload, onerror, …
  svg = svg.replace(/\son[a-z]+\s*=\s*(['"])[\s\S]*?\1/gi, '');
  svg = svg.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '');

  // Dangerous URL schemes in href / xlink:href / src / style urls.
  svg = svg.replace(
    /\s(xlink:href|href|src|data)\s*=\s*(['"])\s*(javascript|vbscript|data\s*:\s*text\/html)[^'"]*\2/gi,
    '',
  );
  svg = svg.replace(
    /\s(xlink:href|href|src|data)\s*=\s*(javascript|vbscript|data\s*:\s*text\/html)[^\s>]*/gi,
    '',
  );

  // style="… expression(…) / url(javascript:…)"
  svg = svg.replace(
    /\sstyle\s*=\s*(['"])[\s\S]*?\1/gi,
    (match) => {
      if (/expression\s*\(|javascript:|vbscript:|data\s*:\s*text\/html/i.test(match)) {
        return '';
      }
      return match;
    },
  );

  // External <use> / <image> that can pull remote scripts or trackers.
  svg = svg.replace(
    /\s(xlink:href|href)\s*=\s*(['"])\s*https?:\/\/[^'"]*\2/gi,
    '',
  );

  if (!/<svg[\s>]/i.test(svg)) {
    throw new AppError('پس از پاک‌سازی، فایل SVG معتبر نیست', 400, 'INVALID_SVG');
  }

  // Prefer UTF-8 XML declaration for consistent rendering.
  if (!/^\s*<\?xml/i.test(svg)) {
    svg = `<?xml version="1.0" encoding="UTF-8"?>\n${svg.trim()}`;
  }

  return Buffer.from(svg, 'utf8');
}
