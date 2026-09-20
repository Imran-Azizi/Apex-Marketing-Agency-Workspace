import fs from "fs/promises";
import { createWriteStream } from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { pipeline } from "stream/promises";
import { storage, generateStorageKey } from "../storage.js";
import { UPLOAD_PURPOSE } from "../storage/media-manager.js";
import { isFfmpegAvailable } from "./optimize-web-mp4.js";
import { env } from "../../config/env.js";

function resolveFfmpeg() {
  return env.ffmpegPath || "ffmpeg";
}

function runFfmpeg(args, { timeoutMs = 60_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(resolveFfmpeg(), args, { windowsHide: true });
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("ffmpeg thumbnail timed out"));
    }, timeoutMs);
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
      if (stderr.length > 12_000) stderr = stderr.slice(-8_000);
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-400)}`));
    });
  });
}

async function downloadToTemp(storageKey) {
  const ext = path.extname(storageKey) || ".mp4";
  const tmp = path.join(
    os.tmpdir(),
    `apex-vthumb-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`,
  );
  const { stream } = await storage.openReadStream(storageKey);
  await pipeline(stream, createWriteStream(tmp));
  return tmp;
}

/**
 * Extract a JPEG poster frame from a stored video.
 * Returns { storageKey, sizeBytes } or null when ffmpeg is unavailable / fails.
 */
export async function extractVideoThumbnail(storageKey, { seekSeconds = 1 } = {}) {
  const available = await isFfmpegAvailable();
  if (!available) return null;

  let inputPath = null;
  let outputPath = null;
  try {
    inputPath = await downloadToTemp(storageKey);
    outputPath = path.join(
      os.tmpdir(),
      `apex-vthumb-out-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`,
    );

    const seek = Math.max(0, Number(seekSeconds) || 0);
    // Try mid-ish frame; fall back to first frame if seek fails.
    try {
      await runFfmpeg([
        "-y",
        "-ss",
        String(seek),
        "-i",
        inputPath,
        "-frames:v",
        "1",
        "-q:v",
        "4",
        "-vf",
        "scale=640:-2",
        outputPath,
      ]);
    } catch {
      await runFfmpeg([
        "-y",
        "-i",
        inputPath,
        "-frames:v",
        "1",
        "-q:v",
        "4",
        "-vf",
        "scale=640:-2",
        outputPath,
      ]);
    }

    const stat = await fs.stat(outputPath);
    if (!stat.size) return null;

    const destKey = generateStorageKey(
      "images/video-storage",
      `thumb-${Date.now()}.jpg`,
    );
    const saved = await storage.saveFile(outputPath, {
      filename: path.basename(destKey),
      contentType: "image/jpeg",
      storageKey: destKey,
      sizeBytes: stat.size,
      uploadContext: { purpose: UPLOAD_PURPOSE.VIDEO_STORAGE_THUMBNAIL },
    });

    return { storageKey: saved.key || destKey, sizeBytes: stat.size };
  } catch (err) {
    console.warn(
      "[video-storage-thumb] extract failed:",
      err?.message || err,
    );
    return null;
  } finally {
    if (inputPath) await fs.unlink(inputPath).catch(() => {});
    if (outputPath) await fs.unlink(outputPath).catch(() => {});
  }
}
