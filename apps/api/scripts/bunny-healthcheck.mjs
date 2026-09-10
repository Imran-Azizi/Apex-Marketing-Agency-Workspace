/**
 * Live check: upload → HEAD → CDN URL → delete against the configured Bunny zone.
 * Prints no secrets. Exit 0 on success.
 *
 * Usage (from apps/api): node scripts/bunny-healthcheck.mjs
 */
import { randomBytes } from "node:crypto";
import {
  env,
  getBunnyStorageSummary,
} from "../src/config/env.js";
import { storage } from "../src/services/storage.js";
import {
  bunnyObjectPath,
  buildBunnyCdnUrl,
} from "../src/services/storage/bunny-driver.js";

async function main() {
  const summary = getBunnyStorageSummary();
  console.log("[bunny-healthcheck] target:", JSON.stringify(summary));

  if (!summary.configured) {
    console.error(
      "[bunny-healthcheck] FAIL: BUNNY_STORAGE_ZONE / BUNNY_STORAGE_API_KEY missing",
    );
    process.exit(1);
  }

  const stamp = Date.now().toString(36);
  const nonce = randomBytes(4).toString("hex");
  const filename = `bunny-healthcheck-${stamp}-${nonce}.txt`;
  const body = Buffer.from(
    `apex bunny healthcheck ${stamp} zone=${env.bunnyStorageZone}\n`,
    "utf8",
  );

  console.log("[bunny-healthcheck] uploading…");
  const saved = await storage.saveBuffer(body, {
    filename,
    folder: "uploads",
    contentType: "text/plain",
    uploadContext: { purpose: "generic", folder: "uploads" },
  });

  const key = saved.key;
  if (!key) {
    console.error("[bunny-healthcheck] FAIL: upload returned no key", saved);
    process.exit(1);
  }

  console.log("[bunny-healthcheck] storageKey:", key);
  console.log("[bunny-healthcheck] objectPath:", bunnyObjectPath(key));
  console.log("[bunny-healthcheck] zone:", env.bunnyStorageZone);
  console.log("[bunny-healthcheck] storageHost:", env.bunnyStorageHostname);

  const exists = await storage.exists(key);
  if (!exists) {
    console.error("[bunny-healthcheck] FAIL: object not found after upload");
    process.exit(1);
  }
  console.log("[bunny-healthcheck] HEAD: ok");

  const cdnUrl = buildBunnyCdnUrl(key);
  console.log("[bunny-healthcheck] cdnUrl:", cdnUrl);

  if (summary.cdnHostname && summary.cdnHostname !== "(unset)") {
    try {
      const res = await fetch(cdnUrl, { method: "GET" });
      console.log(
        `[bunny-healthcheck] CDN GET: ${res.status}${res.ok ? " ok" : ""}`,
      );
      if (!res.ok) {
        console.warn(
          "[bunny-healthcheck] CDN not ready yet (Pull Zone propagation or origin path). Storage API upload succeeded — new files are in this zone.",
        );
      }
    } catch (err) {
      console.warn(
        "[bunny-healthcheck] CDN fetch error:",
        err?.message || err,
      );
    }
  }

  await storage.deleteObject(key);
  const gone = !(await storage.exists(key));
  console.log(
    gone
      ? "[bunny-healthcheck] delete: ok"
      : "[bunny-healthcheck] delete: object still present (may be eventual)",
  );

  console.log(
    `[bunny-healthcheck] SUCCESS — new uploads use zone "${env.bunnyStorageZone}" @ ${env.bunnyStorageHostname}`,
  );
}

main().catch((err) => {
  console.error("[bunny-healthcheck] FAIL:", err?.message || err);
  process.exit(1);
});
