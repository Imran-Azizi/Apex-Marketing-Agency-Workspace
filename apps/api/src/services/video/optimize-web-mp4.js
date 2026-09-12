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

const MAX_OPTIMIZE_BYTES = 512 * 1024 * 1024;

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
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '23',
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
        '128k',
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
    path.basename(sourceKey, path.extname(sourceKey)).replace(/[^\w.-]+/g, '_') ||
    'portfolio';
  return generateStorageKey('videos/portfolio', `${base}.mp4`);
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
 * - optionally remux/re-encode to H.264/AAC + faststart when ffmpeg is available
 * - copy into `videos/portfolio/` when the source is not already a public key
 */
export async function preparePortfolioVideoForWeb(
  sourceKey,
  { preferOptimize = true } = {},
) {
  const source = String(sourceKey || '').trim();
  const head = await assertStoredVideoReady(source);
  const alreadyPublic = isPublicStorageKey(source);
  const canOptimize =
    preferOptimize &&
    (await isFfmpegAvailable()) &&
    head.size <= MAX_OPTIMIZE_BYTES;

  if (alreadyPublic && !canOptimize) {
    return {
      storageKey: source,
      optimized: false,
      copied: false,
      skippedReason: 'ffmpeg_unavailable_or_too_large',
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
      const destKey = publicDestKey(source);
      const saved = await uploadPortfolioMp4(inputPath, destKey, head.size);
      return {
        storageKey: saved.key,
        optimized: false,
        copied: true,
        skippedReason: 'ffmpeg_unavailable_or_too_large',
      };
    }

    let reencode = true;
    try {
      const probe = await probeVideo(inputPath);
      reencode = needsReencode(probe);
    } catch (err) {
      console.warn(
        '[video-optimize] probe failed, re-encoding:',
        err?.message || err,
      );
      reencode = true;
    }

    await optimizeLocalFile(inputPath, outputPath, { reencode });
    const stat = await fs.stat(outputPath);
    const destKey = alreadyPublic
      ? source.replace(/\.[^.]+$/, '') + '.web.mp4'
      : publicDestKey(source);
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
    };
  } finally {
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});
  }
}
