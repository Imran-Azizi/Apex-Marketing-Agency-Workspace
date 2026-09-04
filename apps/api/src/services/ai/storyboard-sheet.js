/**
 * Composites per-scene stills into one labeled cinematic storyboard sheet.
 * Empty grid cells stay blank so the panel count always matches the scenario.
 * Pure JS (jpeg-js / pngjs) so it does not depend on native image binaries.
 */

import { createRequire } from 'node:module';
import { collageGrid } from './storyboard-image-prompt.js';

const require = createRequire(import.meta.url);
const jpeg = require('jpeg-js');
const { PNG } = require('pngjs');

export function storyboardSheetLayout(sceneCount) {
  const n = Math.max(1, Number(sceneCount) || 1);
  const { cols, rows } = collageGrid(n);
  const panelW = 960;
  const panelH = 540;
  const gutter = 28;
  const pad = 40;
  const labelH = 44;
  return {
    n,
    cols,
    rows,
    panelW,
    panelH,
    gutter,
    pad,
    labelH,
    width: pad * 2 + gutter * Math.max(0, cols - 1) + panelW * cols,
    height: pad * 2 + gutter * Math.max(0, rows - 1) + (panelH + labelH) * rows,
    unused: cols * rows - n,
  };
}

function createRgba(width, height, r, g, b, a = 255) {
  const data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    const o = i * 4;
    data[o] = r;
    data[o + 1] = g;
    data[o + 2] = b;
    data[o + 3] = a;
  }
  return { width, height, data };
}

function decodeImage(buffer) {
  if (!buffer || buffer.length < 32) return null;
  try {
    if (buffer[0] === 0xff && buffer[1] === 0xd8) {
      const decoded = jpeg.decode(buffer, {
        maxMemoryUsageInMB: 256,
        useTArray: true,
        formatAsRGBA: true,
      });
      if (!decoded?.width || !decoded?.height || decoded.width < 8 || decoded.height < 8) {
        return null;
      }
      return {
        width: decoded.width,
        height: decoded.height,
        data: Buffer.from(decoded.data),
      };
    }
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e) {
      const decoded = PNG.sync.read(buffer);
      if (!decoded?.width || !decoded?.height || decoded.width < 8 || decoded.height < 8) {
        return null;
      }
      return {
        width: decoded.width,
        height: decoded.height,
        data: Buffer.from(decoded.data),
      };
    }
  } catch {
    return null;
  }
  return null;
}

function sampleBilinear(src, x, y) {
  const x0 = Math.min(src.width - 1, Math.max(0, Math.floor(x)));
  const y0 = Math.min(src.height - 1, Math.max(0, Math.floor(y)));
  const x1 = Math.min(src.width - 1, x0 + 1);
  const y1 = Math.min(src.height - 1, y0 + 1);
  const fx = x - Math.floor(x);
  const fy = y - Math.floor(y);
  const i00 = (y0 * src.width + x0) * 4;
  const i10 = (y0 * src.width + x1) * 4;
  const i01 = (y1 * src.width + x0) * 4;
  const i11 = (y1 * src.width + x1) * 4;
  const mix = (a, b, t) => a + (b - a) * t;
  return [
    mix(mix(src.data[i00], src.data[i10], fx), mix(src.data[i01], src.data[i11], fx), fy),
    mix(mix(src.data[i00 + 1], src.data[i10 + 1], fx), mix(src.data[i01 + 1], src.data[i11 + 1], fx), fy),
    mix(mix(src.data[i00 + 2], src.data[i10 + 2], fx), mix(src.data[i01 + 2], src.data[i11 + 2], fx), fy),
  ];
}

function coverResize(src, dw, dh, { brightness = 1, saturation = 1 } = {}) {
  const scale = Math.max(dw / src.width, dh / src.height);
  const ox = (src.width * scale - dw) / 2;
  const oy = (src.height * scale - dh) / 2;
  const out = Buffer.alloc(dw * dh * 4);
  for (let y = 0; y < dh; y += 1) {
    for (let x = 0; x < dw; x += 1) {
      const [r0, g0, b0] = sampleBilinear(src, (x + ox) / scale, (y + oy) / scale);
      let r = r0 * brightness;
      let g = g0 * brightness;
      let b = b0 * brightness;
      if (saturation !== 1) {
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        r = gray + (r - gray) * saturation;
        g = gray + (g - gray) * saturation;
        b = gray + (b - gray) * saturation;
      }
      const o = (y * dw + x) * 4;
      out[o] = Math.max(0, Math.min(255, r));
      out[o + 1] = Math.max(0, Math.min(255, g));
      out[o + 2] = Math.max(0, Math.min(255, b));
      out[o + 3] = 255;
    }
  }
  return { width: dw, height: dh, data: out };
}

function blit(dst, src, left, top) {
  const x0 = Math.max(0, left);
  const y0 = Math.max(0, top);
  const x1 = Math.min(dst.width, left + src.width);
  const y1 = Math.min(dst.height, top + src.height);
  for (let y = y0; y < y1; y += 1) {
    const srcY = y - top;
    const dstRow = (y * dst.width + x0) * 4;
    const srcRow = (srcY * src.width + (x0 - left)) * 4;
    src.data.copy(dst.data, dstRow, srcRow, srcRow + (x1 - x0) * 4);
  }
}

function fillRect(dst, left, top, width, height, r, g, b, a = 255) {
  const x0 = Math.max(0, left);
  const y0 = Math.max(0, top);
  const x1 = Math.min(dst.width, left + width);
  const y1 = Math.min(dst.height, top + height);
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const o = (y * dst.width + x) * 4;
      if (a >= 255) {
        dst.data[o] = r;
        dst.data[o + 1] = g;
        dst.data[o + 2] = b;
        dst.data[o + 3] = 255;
      } else {
        const t = a / 255;
        dst.data[o] = Math.round(dst.data[o] * (1 - t) + r * t);
        dst.data[o + 1] = Math.round(dst.data[o + 1] * (1 - t) + g * t);
        dst.data[o + 2] = Math.round(dst.data[o + 2] * (1 - t) + b * t);
      }
    }
  }
}

// 5x7 bitmap glyphs for SCENE labels (ASCII only).
const GLYPHS = {
  ' ': '00000000000000000000000000000000000',
  '-': '00000000000000011111000000000000000',
  0: '01110100011000110001100010111000000',
  1: '00100011000010000100001000111000000',
  2: '01110100010000100110010001111100000',
  3: '01110100010011000001100010111000000',
  4: '00010001100101011111000100001000000',
  5: '11111100001111000001100010111000000',
  6: '01110100001111010001100010111000000',
  7: '11111000010001000100010000100000000',
  8: '01110100010111010001100010111000000',
  9: '01110100011000101111000010111000000',
  A: '01110100011111110001100011000100000',
  B: '11110100011111010001100011111000000',
  C: '01110100011000010000100010111000000',
  D: '11100100011000110001100011110000000',
  E: '11111100001111010000100001111100000',
  F: '11111100001111010000100001000000000',
  G: '01110100011000010011100010111000000',
  H: '10001100011111110001100011000100000',
  I: '11110001000010000100001000111100000',
  J: '00111000010000100001100010111000000',
  K: '10001100101110010100100101000100000',
  L: '10000100001000010000100001111100000',
  M: '10001110111010110001100011000100000',
  N: '10001110011010110011100011000100000',
  O: '01110100011000110001100010111000000',
  P: '11110100011111010000100001000000000',
  Q: '01110100011000110001101010110100000',
  R: '11110100011111010010100101000100000',
  S: '01111100000111000001100011111000000',
  T: '11111001000010000100001000010000000',
  U: '10001100011000110001100010111000000',
  V: '10001100011000110001010100010000000',
  W: '10001100011000110101110111000100000',
  X: '10001100010111000100100011000100000',
  Y: '10001100010111000100001000010000000',
  Z: '11111000010001000100010001111100000',
};

function drawText(dst, left, top, text, scale, r, g, b) {
  let x = left;
  const chars = String(text || '').toUpperCase();
  for (const ch of chars) {
    const glyph = GLYPHS[ch] || GLYPHS['-'];
    for (let gy = 0; gy < 7; gy += 1) {
      for (let gx = 0; gx < 5; gx += 1) {
        if (glyph[gy * 5 + gx] !== '1') continue;
        fillRect(dst, x + gx * scale, top + gy * scale, scale, scale, r, g, b);
      }
    }
    x += 6 * scale;
  }
}

function asciiCaption(title) {
  const raw = String(title || '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
  return raw.slice(0, 28);
}

function drawPanelFrame(dst, layout, left, top, panel) {
  fillRect(dst, left, top, layout.panelW, layout.panelH, 26, 29, 36);
  const decoded =
    panel?.buffer && panel.buffer.length > 32 ? decodeImage(panel.buffer) : null;
  if (decoded) {
    const framed = coverResize(decoded, layout.panelW, layout.panelH, {
      brightness: 1.08,
      saturation: 1.04,
    });
    blit(dst, framed, left, top);
  }

  if (!panel) return;

  const sceneNo = panel.sceneNumber || 1;
  fillRect(dst, left + 12, top + 12, 52, 32, 17, 19, 24, 220);
  drawText(dst, left + 24, top + 18, String(sceneNo), 2, 244, 244, 245);
  fillRect(dst, left, top + layout.panelH, layout.panelW, layout.labelH, 22, 24, 29);
  drawText(dst, left + 16, top + layout.panelH + 12, `SCENE ${sceneNo}`, 3, 244, 244, 245);
  const caption = asciiCaption(panel.title);
  if (caption) {
    drawText(dst, left + 168, top + layout.panelH + 14, caption, 2, 154, 160, 166);
  }
}

function yieldEventLoop() {
  return new Promise((resolve) => setImmediate(resolve));
}

/**
 * @param {Array<{ buffer?: Buffer|null, sceneNumber?: number, title?: string }>} panels
 * @returns {Promise<Buffer>}
 */
export async function composeStoryboardSheet(panels = []) {
  const list = Array.isArray(panels) ? panels : [];
  const layout = storyboardSheetLayout(list.length || 1);
  const sheet = createRgba(layout.width, layout.height, 15, 17, 21);

  for (let i = 0; i < layout.cols * layout.rows; i += 1) {
    const col = i % layout.cols;
    const row = Math.floor(i / layout.cols);
    const left = layout.pad + col * (layout.panelW + layout.gutter);
    const top = layout.pad + row * (layout.panelH + layout.labelH + layout.gutter);
    drawPanelFrame(sheet, layout, left, top, list[i] || null);
    await yieldEventLoop();
  }

  await yieldEventLoop();
  const encoded = jpeg.encode(
    { data: sheet.data, width: sheet.width, height: sheet.height },
    90,
  );
  return Buffer.from(encoded.data);
}
