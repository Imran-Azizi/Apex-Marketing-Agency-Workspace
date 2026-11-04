import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { pipeline } from 'stream/promises';
import { storage, generateStorageKey } from '../storage.js';
import {
  UPLOAD_PURPOSE,
  isPublicStorageKey,
} from '../storage/media-manager.js';
import { AppError } from '../../utils/response.js';
import { env } from '../../config/env.js';

/** Skip optimize above this — download + encode would stress the VPS. */
const MAX_OPTIMIZE_BYTES = 512 * 1024 * 1024;
/** Public portfolio target: keep files small enough for weak mobile links. */
const WEB_SOFT_MAX_BYTES = 12 * 1024 * 1024;
const WEB_MAX_LONG_EDGE = 1080;
const WEB_MAX_BITRATE = 3_000_000;

function resolveBinary(kind) {
  if (kind === 'ffmpeg') return env.ffmpegPath || 'ffmpeg';
  return env.ffprobePath || 'ffprobe';
}

function runCommand(bin, args, { timeoutMs = 10 * 60 * 1000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { windowsHide: true });
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`${bin} timed out`));
    }, timeoutMs);
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
      if (stderr.length > 20_000) stderr = stderr.slice(-12_000);
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stderr });
      else reject(new Error(`${bin} exited ${code}: ${stderr.slice(-800)}`));
    });
  });
}

let ffmpegAvailability = null;

export async function isFfmpegAvailable() {
  if (ffmpegAvailability != null) return ffmpegAvailability;
  try {
    await runCommand(resolveBinary('ffmpeg'), ['-version'], { timeoutMs: 8_000 });
    await runCommand(resolveBinary('ffprobe'), ['-version'], { timeoutMs: 8_000 });
    ffmpegAvailability = true;
  } catch {
    ffmpegAvailability = false;
    console.warn(
      '[video-optimize] ffmpeg/ffprobe not available — portfolio videos will be served as uploaded. Install ffmpeg or set FFMPEG_PATH/FFPROBE_PATH for web remux/re-encode.',
    );
  }
  return ffmpegAvailability;
}

function probeVideo(filePath) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      resolveBinary('ffprobe'),
      [
        '-v',
        'quiet',
        '-print_format',
        'json',
        '-show_streams',
        '-show_format',
        filePath,
      ],
      { windowsHide: true },
    );
    let stdout = '';
    let err = '';
    child.stdout.on('data', (c) => {
      stdout += String(c);
    });
    child.stderr.on('data', (c) => {
      err += String(c);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(err || `ffprobe failed (${code})`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (parseErr) {
        reject(parseErr);
      }
    });
  });
}

function parseFrameRate(rate) {
  if (!rate || rate === '0/0') return null;
  const [a, b] = String(rate).split('/').map(Number);
  if (!a || !b) return null;
  return a / b;
}

/**
 * Walk top-level ISO-BMFF boxes to see whether `moov` appears before `mdat`.
 * Without faststart, browsers must download nearly the whole file before play.
 */
async function inspectMp4Faststart(filePath) {
  const fh = await fs.open(filePath, 'r');
  try {
    const stat = await fh.stat();
    let offset = 0;
    let moovAt = null;
    let mdatAt = null;
    const buf = Buffer.alloc(16);

    while (offset + 8 <= stat.size) {
      await fh.read(buf, 0, 8, offset);
      let size = buf.readUInt32BE(0);
      const type = buf.toString('ascii', 4, 8);
      let header = 8;
      if (size === 1) {
        if (offset + 16 > stat.size) break;
        await fh.read(buf, 0, 8, offset + 8);
        size = Number(buf.readBigUInt64BE(0));
        header = 16;
      } else if (size === 0) {
        size = stat.size - offset;
      }
      if (!Number.isFinite(size) || size < header) break;

      if (type === 'moov' && moovAt == null) moovAt = offset;
      if (type === 'mdat' && mdatAt == null) mdatAt = offset;
      if (moovAt != null && mdatAt != null) break;

      offset += size;
    }

    return {
      faststart: moovAt != null && (mdatAt == null || moovAt < mdatAt),
      moovAt,
      mdatAt,
    };
  } finally {
    await fh.close();
  }
}

function needsReencode(probe) {
  const streams = probe?.streams || [];
  const video = streams.find((s) => s.codec_type === 'video');
  const audio = streams.find((s) => s.codec_type === 'audio');
  if (!video) return true;
  const videoOk = ['h264', 'avc1'].includes(
    String(video.codec_name || '').toLowerCase(),
  );
  const audioOk =
    !audio ||
    ['aac', 'mp3'].includes(String(audio.codec_name || '').toLowerCase());
  const fps =
    parseFrameRate(video.avg_frame_rate) || parseFrameRate(video.r_frame_rate);
  const avg = parseFrameRate(video.avg_frame_rate);
  const r = parseFrameRate(video.r_frame_rate);
  const vfrLikely = avg != null && r != null && Math.abs(avg - r) > 0.5;
  const oddFps = fps != null && (fps < 20 || fps > 60);
  return !videoOk || !audioOk || vfrLikely || oddFps;
}

function needsWebCompress(probe, sizeBytes) {
  if (sizeBytes > WEB_SOFT_MAX_BYTES) return true;
  const video = (probe?.streams || []).find((s) => s.codec_type === 'video');
  if (!video) return true;
  const w = Number(video.width || 0);
  const h = Number(video.height || 0);
  if (Math.max(w, h) > WEB_MAX_LONG_EDGE) return true;
  const br =
    Number(video.bit_rate || 0) ||
    Number(probe?.format?.bit_rate || 0) ||
    0;
  if (br > WEB_MAX_BITRATE) return true;
  return false;
}

async function downloadToTemp(storageKey, suffix = '.bin') {
  const tmp = path.join(
    os.tmpdir(),
    `apex-pf-${Date.now()}-${Math.random().toString(36).slice(2)}${suffix}`,
  );
  const { stream } = await storage.openReadStream(storageKey);
  await pipeline(stream, createWriteStream(tmp));
  return tmp;
}

async function optimizeLocalFile(inputPath, outputPath, { reencode }) {
  const args = reencode
    ? [
        '-y',
        '-i',
        inputPath,
        '-map',
        '0:v:0',
        '-map',
        '0:a:0?',
        // Fit inside 1080 on the long edge (spawn has no shell — escape for ffmpeg filtergraph).
        '-vf',
        `scale=w=if(gte(iw\\,ih)\\,min(${WEB_MAX_LONG_EDGE}\\,iw)\\,-2):h=if(gte(ih\\,iw)\\,min(${WEB_MAX_LONG_EDGE}\\,ih)\\,-2)`,
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '26',
        '-maxrate',
        '2500k',
        '-bufsize',
        '5000k',
        '-pix_fmt',
        'yuv420p',
        '-profile:v',
        'main',
        '-level',
        '4.0',
        '-r',
        '30',
        '-g',
        '60',
        '-vsync',
        'cfr',
        '-c:a',
        'aac',
        '-b:a',
        '96k',
        '-ac',
        '2',
        '-ar',
        '48000',
        '-movflags',
        '+faststart',
        outputPath,
      ]
    : [
        '-y',
        '-i',
        inputPath,
        '-c',
        'copy',
        '-movflags',
        '+faststart',
        outputPath,
      ];
  await runCommand(resolveBinary('ffmpeg'), args, {
    timeoutMs: 15 * 60 * 1000,
  });
}

async function uploadPortfolioMp4(localPath, destKey, sizeBytes) {
  return storage.saveFile(localPath, {
    filename: path.basename(destKey),
    contentType: 'video/mp4',
    storageKey: destKey,
    sizeBytes,
    uploadContext: { purpose: UPLOAD_PURPOSE.PORTFOLIO_VIDEO },
  });
}

function publicDestKey(sourceKey) {
  const base =
    path
      .basename(sourceKey, path.extname(sourceKey))
      .replace(/\.web$/i, '')
      .replace(/[^\w.-]+/g, '_') || 'portfolio';
  return generateStorageKey('videos/portfolio', `${base}.web.mp4`);
}

/**
 * Ensure a stored object exists and is large enough to be a real video.
 */
export async function assertStoredVideoReady(storageKey) {
  const key = String(storageKey || '').trim();
  if (!key) {
    throw new AppError('ویدیوی نمونه‌کار الزامی است', 400, 'VIDEO_REQUIRED');
  }
  let head;
  try {
    head = await storage.head(key);
  } catch (err) {
    if (err instanceof AppError && err.code === 'NOT_FOUND') {
      throw new AppError(
        'آپلود ویدیو کامل نشده یا فایل در فضای ذخیره‌سازی یافت نشد',
        400,
        'VIDEO_NOT_UPLOADED',
      );
    }
    throw err;
  }
  if (!head?.size || head.size < 1024) {
    throw new AppError(
      'فایل ویدیو ناقص است؛ لطفاً دوباره بارگذاری کنید',
      400,
      'VIDEO_INCOMPLETE',
    );
  }
  return head;
}

/**
 * Prepare a portfolio video for public web playback:
 * - verify object exists on Bunny
 * - remux/re-encode to H.264/AAC + faststart (+ size cap) when ffmpeg is available
 * - copy into `videos/portfolio/` when the source is not already a public key
 *
 * @param {string} sourceKey
 * @param {{ preferOptimize?: boolean, force?: boolean }} [options]
 */
export async function preparePortfolioVideoForWeb(
  sourceKey,
  { preferOptimize = true, force = false } = {},
) {
  const source = String(sourceKey || '').trim();
  const head = await assertStoredVideoReady(source);
  const alreadyPublic = isPublicStorageKey(source);
  const canOptimize =
    preferOptimize &&
    (await isFfmpegAvailable()) &&
    head.size <= MAX_OPTIMIZE_BYTES;

  if (alreadyPublic && !canOptimize && !force) {
    return {
      storageKey: source,
      optimized: false,
      copied: false,
      skippedReason: 'ffmpeg_unavailable_or_too_large',
      bytes: head.size,
    };
  }

  const inputPath = await downloadToTemp(
    source,
    path.extname(source) || '.mp4',
  );
  const outputPath = path.join(
    os.tmpdir(),
    `apex-pf-out-${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`,
  );

  try {
    if (!canOptimize) {
      if (alreadyPublic) {
        return {
          storageKey: source,
          optimized: false,
          copied: false,
          skippedReason: 'ffmpeg_unavailable_or_too_large',
          bytes: head.size,
        };
      }
      const destKey = publicDestKey(source);
      const saved = await uploadPortfolioMp4(inputPath, destKey, head.size);
      return {
        storageKey: saved.key,
        optimized: false,
        copied: true,
        skippedReason: 'ffmpeg_unavailable_or_too_large',
        bytes: head.size,
      };
    }

    let reencode = true;
    let faststart = false;
    try {
      const [probe, layout] = await Promise.all([
        probeVideo(inputPath),
        inspectMp4Faststart(inputPath),
      ]);
      faststart = Boolean(layout.faststart);
      reencode =
        needsReencode(probe) || needsWebCompress(probe, head.size);
      // `--force` re-compresses even when the file already looks web-ready.
      if (force && !reencode && faststart) reencode = true;
    } catch (err) {
      console.warn(
        '[video-optimize] probe failed, re-encoding:',
        err?.message || err,
      );
      reencode = true;
      faststart = false;
    }

    const needsRemux = !faststart;
    if (!reencode && !needsRemux) {
      if (alreadyPublic) {
        return {
          storageKey: source,
          optimized: false,
          copied: false,
          skippedReason: 'already_web_ready',
          bytes: head.size,
          faststart: true,
        };
      }
      const destKey = publicDestKey(source);
      const saved = await uploadPortfolioMp4(inputPath, destKey, head.size);
      return {
        storageKey: saved.key,
        optimized: false,
        copied: true,
        bytes: head.size,
        faststart: true,
      };
    }

    await optimizeLocalFile(inputPath, outputPath, { reencode });
    const stat = await fs.stat(outputPath);
    const destKey = publicDestKey(source);
    const saved = await uploadPortfolioMp4(outputPath, destKey, stat.size);

    if (alreadyPublic && saved.key !== source) {
      await storage.tryDeleteStoredObject(source, {
        logTag: 'portfolio-optimize',
      });
    }

    return {
      storageKey: saved.key,
      optimized: true,
      copied: !alreadyPublic || saved.key !== source,
      reencoded: reencode,
      bytes: stat.size,
      bytesBefore: head.size,
      faststart: true,
    };
  } finally {
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});
  }
}
