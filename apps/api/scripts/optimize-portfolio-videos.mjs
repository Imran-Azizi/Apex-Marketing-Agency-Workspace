/**
 * Remux / re-encode published portfolio videos for fast public web playback:
 * H.264/AAC, moov faststart, ~1080p long-edge, bitrate cap.
 *
 * Requires ffmpeg + ffprobe on PATH (or FFMPEG_PATH / FFPROBE_PATH in .env).
 *
 * Usage (from apps/api on the VPS):
 *   node scripts/optimize-portfolio-videos.mjs
 *   node scripts/optimize-portfolio-videos.mjs --limit=20
 *   node scripts/optimize-portfolio-videos.mjs --id=cmucd9mzm001zla9ex3jxz7vg
 *   node scripts/optimize-portfolio-videos.mjs --force
 *   node scripts/optimize-portfolio-videos.mjs --dry-run
 */
import { prisma } from '../src/db/prisma.js';
import {
  isFfmpegAvailable,
  preparePortfolioVideoForWeb,
} from '../src/services/video/optimize-web-mp4.js';
import { afterPublicPortfolioMutation } from '../src/modules/portfolio/public-invalidate.js';

function argValue(name, fallback = null) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  return hit.slice(name.length + 3);
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

async function optimizeOne(item, { force, dryRun }) {
  const sourceKey =
    item.storageKey ||
    (!item.videoFile?.deletedAt ? item.videoFile?.storageKey : null);
  if (!sourceKey) {
    return { id: item.id, slug: item.slug, skippedReason: 'no_video' };
  }
  if (dryRun) {
    return {
      id: item.id,
      slug: item.slug,
      title: item.title,
      storageKey: sourceKey,
      dryRun: true,
    };
  }
  const prepared = await preparePortfolioVideoForWeb(sourceKey, {
    preferOptimize: true,
    force,
  });
  if (prepared.storageKey && prepared.storageKey !== item.storageKey) {
    await prisma.portfolioItem.update({
      where: { id: item.id },
      data: { storageKey: prepared.storageKey },
    });
  }
  await afterPublicPortfolioMutation({ slug: item.slug });
  return {
    id: item.id,
    slug: item.slug,
    title: item.title,
    ...prepared,
    storageKey: prepared.storageKey || item.storageKey,
  };
}

async function main() {
  const id = argValue('id');
  const limit = Number(argValue('limit', '50')) || 50;
  // Default: only rewrite files that lack faststart / are too heavy.
  const force = hasFlag('force');
  const dryRun = hasFlag('dry-run');

  const ffmpegOk = await isFfmpegAvailable();
  console.log(
    `[portfolio-optimize] ffmpeg=${ffmpegOk ? 'yes' : 'NO'} force=${force} dryRun=${dryRun}`,
  );
  if (!ffmpegOk && !dryRun) {
    console.error(
      '[portfolio-optimize] Install ffmpeg/ffprobe on this host, then re-run.\n' +
        '  Ubuntu: sudo apt-get update && sudo apt-get install -y ffmpeg',
    );
    process.exit(1);
  }

  const where = {
    deletedAt: null,
    status: 'PUBLISHED',
    ...(id ? { id } : {}),
  };

  const items = await prisma.portfolioItem.findMany({
    where,
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    take: id ? 1 : Math.min(Math.max(limit, 1), 200),
    select: {
      id: true,
      slug: true,
      title: true,
      storageKey: true,
      videoFile: { select: { storageKey: true, deletedAt: true } },
    },
  });

  if (!items.length) {
    console.log('[portfolio-optimize] no matching published items');
    process.exit(0);
  }

  console.log(`[portfolio-optimize] processing ${items.length} item(s)…`);
  let optimized = 0;
  let skipped = 0;
  let failed = 0;

  for (const item of items) {
    try {
      const result = await optimizeOne(item, { force, dryRun });
      if (result.error) failed += 1;
      else if (result.skippedReason || result.dryRun) skipped += 1;
      else if (result.optimized) optimized += 1;
      else skipped += 1;

      const sizeNote =
        result.bytesBefore && result.bytes
          ? ` ${Math.round(result.bytesBefore / 1024 / 1024)}MB → ${Math.round(result.bytes / 1024 / 1024)}MB`
          : result.bytes
            ? ` ${Math.round(result.bytes / 1024 / 1024)}MB`
            : '';
      console.log(
        `  • ${result.slug || result.id}: optimized=${Boolean(result.optimized)}` +
          `${result.reencoded ? ' reencoded' : ''}` +
          `${result.skippedReason ? ` skip=${result.skippedReason}` : ''}` +
          `${result.dryRun ? ' dry-run' : ''}` +
          sizeNote,
      );
    } catch (err) {
      failed += 1;
      console.error(`  • ${item.slug || item.id}: FAIL ${err?.message || err}`);
    }
  }

  console.log(
    `[portfolio-optimize] done optimized=${optimized} skipped=${skipped} failed=${failed}`,
  );
  await prisma.$disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch(async (err) => {
  console.error('[portfolio-optimize] fatal:', err?.message || err);
  try {
    await prisma.$disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
