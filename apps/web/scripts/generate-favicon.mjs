/**
 * Builds high-contrast favicons from public/brand/apex-logo.png.
 * Source logo is dark grey RGB with the mark in the alpha channel —
 * we render it white on a near-black rounded square for tab contrast.
 */
import sharp from "sharp";
import { mkdir, writeFile } from "fs/promises";
import { resolve } from "path";

const srcPath = resolve("public/brand/apex-logo.png");
const outDir = resolve("public/brand/favicon");
await mkdir(outDir, { recursive: true });

const { data, info } = await sharp(srcPath)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const w = info.width;
const h = info.height;
const out = Buffer.alloc(data.length);
const ALPHA_CUTOFF = 8;

let minX = w;
let minY = h;
let maxX = 0;
let maxY = 0;

for (let i = 0; i < data.length; i += 4) {
  const a = data[i + 3];
  if (a < ALPHA_CUTOFF) {
    out[i] = 0;
    out[i + 1] = 0;
    out[i + 2] = 0;
    out[i + 3] = 0;
    continue;
  }
  // White mark, preserve anti-aliased alpha
  out[i] = 255;
  out[i + 1] = 255;
  out[i + 2] = 255;
  out[i + 3] = a;
  const px = (i / 4) % w;
  const py = Math.floor(i / 4 / w);
  if (px < minX) minX = px;
  if (py < minY) minY = py;
  if (px > maxX) maxX = px;
  if (py > maxY) maxY = py;
}

// Row density — find gap between emblem and wordmark below
const rowCounts = new Array(h).fill(0);
for (let y = minY; y <= maxY; y++) {
  let c = 0;
  for (let x = minX; x <= maxX; x++) {
    if (out[(y * w + x) * 4 + 3] > 0) c++;
  }
  rowCounts[y] = c;
}

const contentH = maxY - minY + 1;
const searchStart = minY + Math.floor(contentH * 0.35);
const searchEnd = minY + Math.floor(contentH * 0.75);
let gapY = -1;
let gapBest = Infinity;
for (let y = searchStart; y <= searchEnd; y++) {
  if (rowCounts[y] < gapBest) {
    gapBest = rowCounts[y];
    gapY = y;
  }
}

let eMaxY = maxY;
if (gapY > 0 && gapBest < (maxX - minX + 1) * 0.02) {
  eMaxY = gapY - 1;
} else {
  // Fallback: upper ~58% of the lockup (emblem only)
  eMaxY = minY + Math.floor(contentH * 0.58);
}

let eMinX = w;
let eMinY = h;
let eMaxX = 0;
for (let y = minY; y <= eMaxY; y++) {
  for (let x = minX; x <= maxX; x++) {
    if (out[(y * w + x) * 4 + 3] > 0) {
      if (x < eMinX) eMinX = x;
      if (y < eMinY) eMinY = y;
      if (x > eMaxX) eMaxX = x;
      if (y > eMaxY) eMaxY = y;
    }
  }
}

if (eMaxX < eMinX || eMaxY < eMinY) {
  throw new Error("Could not locate logo emblem bounds from alpha channel");
}

const pad = 24;
const cropLeft = Math.max(0, eMinX - pad);
const cropTop = Math.max(0, eMinY - pad);
const cropWidth = Math.min(w - cropLeft, eMaxX - eMinX + 1 + pad * 2);
const cropHeight = Math.min(h - cropTop, eMaxY - eMinY + 1 + pad * 2);

console.log("emblem crop", { cropLeft, cropTop, cropWidth, cropHeight, gapY, gapBest });

const whiteMark = await sharp(out, {
  raw: { width: w, height: h, channels: 4 },
})
  .extract({
    left: cropLeft,
    top: cropTop,
    width: cropWidth,
    height: cropHeight,
  })
  .png()
  .toBuffer();

await sharp(whiteMark).png().toFile(resolve(outDir, "apex-mark-white.png"));

async function makeFavicon(
  size,
  { bg = "#0a0a0a", radiusRatio = 0.18, inset = 0.16 } = {},
) {
  const radius = Math.round(size * radiusRatio);
  const svgBg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="${bg}"/>
    </svg>`,
  );
  const markSize = Math.round(size * (1 - inset * 2));
  const resizedMark = await sharp(whiteMark)
    .resize(markSize, markSize, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  const left = Math.round((size - markSize) / 2);
  const top = Math.round((size - markSize) / 2);

  return sharp(svgBg)
    .composite([{ input: resizedMark, left, top }])
    .png()
    .toBuffer();
}

const sizes = [
  [16, "favicon-16x16.png"],
  [32, "favicon-32x32.png"],
  [48, "favicon-48x48.png"],
  [180, "apple-touch-icon.png"],
  [192, "android-chrome-192x192.png"],
  [512, "android-chrome-512x512.png"],
];

for (const [size, name] of sizes) {
  const buf = await makeFavicon(size);
  await writeFile(resolve(outDir, name), buf);
  console.log("wrote", name, buf.length);
}

// Next.js App Router file-based metadata icons
await writeFile(resolve("app/icon.png"), await makeFavicon(32));
await writeFile(resolve("app/apple-icon.png"), await makeFavicon(180));

/** Multi-size ICO from PNG frames (no extra deps). */
function pngToIco(pngBuffers) {
  const images = pngBuffers.map((buf) => {
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    return {
      buf,
      width: width >= 256 ? 0 : width,
      height: height >= 256 ? 0 : height,
    };
  });
  const headerSize = 6 + 16 * images.length;
  const parts = [];
  let offset = headerSize;
  const entries = Buffer.alloc(16 * images.length);
  images.forEach((img, i) => {
    const o = i * 16;
    entries[o] = img.width;
    entries[o + 1] = img.height;
    entries[o + 2] = 0;
    entries[o + 3] = 0;
    entries.writeUInt16LE(1, o + 4);
    entries.writeUInt16LE(32, o + 6);
    entries.writeUInt32LE(img.buf.length, o + 8);
    entries.writeUInt32LE(offset, o + 12);
    parts.push(img.buf);
    offset += img.buf.length;
  });
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  return Buffer.concat([header, entries, ...parts]);
}

const ico = pngToIco([
  await makeFavicon(16),
  await makeFavicon(32),
  await makeFavicon(48),
]);
await writeFile(resolve("public/favicon.ico"), ico);
await writeFile(resolve(outDir, "favicon.ico"), ico);

const manifest = {
  name: "اپیکس ورک‌اسپیس",
  short_name: "اپیکس",
  icons: [
    {
      src: "/brand/favicon/android-chrome-192x192.png",
      sizes: "192x192",
      type: "image/png",
    },
    {
      src: "/brand/favicon/android-chrome-512x512.png",
      sizes: "512x512",
      type: "image/png",
    },
  ],
  theme_color: "#0a0a0a",
  background_color: "#0a0a0a",
  display: "standalone",
};
await writeFile(
  resolve("public/site.webmanifest"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);

console.log("wrote favicon.ico", ico.length);
console.log("done");
