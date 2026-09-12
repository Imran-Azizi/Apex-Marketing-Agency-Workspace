import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { SECURITY } from "./config/security.js";
import { globalLimiter } from "./middleware/rateLimit.js";
import { issueCsrf } from "./middleware/csrf.js";
import { optionalAuth } from "./middleware/auth.js";
import { normalizeDigitsMiddleware } from "./middleware/normalizeDigits.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { AppError } from "./utils/response.js";

import authRoutes from "./modules/auth/index.js";
import crmRoutes from "./modules/crm/index.js";
import portalRoutes from "./modules/portal/index.js";
import projectRoutes from "./modules/projects/index.js";
import aiRoutes from "./modules/ai/index.js";
import deliveryRoutes from "./modules/delivery/index.js";
import publicRoutes from "./modules/public/index.js";
import settingsRoutes from "./modules/settings/index.js";
import permissionRoutes from "./modules/permissions/index.js";
import notificationRoutes from "./modules/notifications/index.js";
import auditRoutes from "./modules/audit/index.js";
import fileRoutes from "./modules/files/index.js";
import narrationRoutes from "./modules/narration/index.js";
import employeeRoutes from "./modules/employees/index.js";
import productionRoutes from "./modules/production/index.js";
import backupRoutes from "./modules/backup/index.js";
import portfolioRoutes from "./modules/portfolio/index.js";
import servicesRoutes from "./modules/services/index.js";
import contactRoutes from "./modules/contact/index.js";
import heroRoutes from "./modules/hero/index.js";
import customersRoutes from "./modules/customers/index.js";
import financeRoutes from "./modules/finance/index.js";
import chatRoutes from "./modules/chat/index.js";
import salesAssistantRoutes from "./modules/sales-assistant/index.js";
import businessAssistantRoutes from "./modules/business-assistant/index.js";
import { storage } from "./services/storage.js";
import {
  isCleanFinalStorageKey,
  isPublicStorageKey,
  stripStoragePrefix,
} from "./services/storage/media-manager.js";
import { assertRawStorageAccess } from "./modules/files/rawAccess.js";

function runOptionalAuth(req, res) {
  return new Promise((resolve, reject) => {
    optionalAuth(req, res, (err) => (err ? reject(err) : resolve()));
  });
}

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'none'"],
          formAction: ["'none'"],
          objectSrc: ["'none'"],
          styleSrc: ["'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      frameguard: { action: "deny" },
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      hsts: env.isProd
        ? { maxAge: 31536000, includeSubDomains: true, preload: false }
        : false,
    }),
  );
  app.use(compression());
  app.use(
    cors({
      origin(origin, callback) {
        // Allow non-browser clients (no Origin) and configured web origins only.
        if (!origin) return callback(null, true);
        if (env.corsOrigins.includes(origin)) return callback(null, true);
        return callback(null, false);
      },
      credentials: true,
      methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "X-CSRF-Token", "X-APEX-Panel", "Range"],
      exposedHeaders: [
        "Content-Range",
        "Accept-Ranges",
        "Content-Length",
        "Content-Type",
      ],
    }),
  );
  // Health must stay before rate-limit / CSRF so uptime probes always succeed.
  app.get("/health", (req, res) => {
    res.status(200).json({
      success: true,
      data: {
        status: "ok",
        time: new Date().toISOString(),
      },
    });
  });

  app.use(
    express.json({
      limit: SECURITY.request.jsonLimit,
      verify: (req, _res, buf) => {
        // Meta WhatsApp signature verification needs the raw body bytes.
        const path = String(req.originalUrl || req.url || "");
        if (path.includes("/webhooks/whatsapp")) {
          req.rawBody = Buffer.from(buf);
        }
      },
    }),
  );
  app.use(
    express.urlencoded({
      extended: true,
      limit: SECURITY.request.urlencodedLimit,
    }),
  );
  app.use(cookieParser());
  // Convert Persian/Arabic-Indic digits → English before any route logic
  app.use(normalizeDigitsMiddleware);

  // File delivery. Public marketing prefixes are unauthenticated; everything else
  // requires a signed token or a valid session, and never serves CLEAN_FINAL.
  app.use("/files", async (req, res, next) => {
    const key = String(req.path || "").replace(/^\/+/, "");
    if (!key) {
      res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "File key required" },
      });
      return;
    }
    try {
      let decoded;
      try {
        decoded = decodeURIComponent(key);
      } catch {
        throw new AppError("شناسه فایل نامعتبر است", 400, "INVALID_KEY");
      }

      if (isCleanFinalStorageKey(decoded)) {
        throw new AppError(
          "از مسیر امن رسانه استفاده کنید",
          403,
          "USE_MEDIA_ROUTE",
        );
      }

      if (!isPublicStorageKey(decoded)) {
        const signed = req.query?.token;
        if (signed) {
          const payload = storage.verifySignedToken(String(signed));
          if (payload.key !== decoded && payload.key !== key) {
            throw new AppError(
              "Download link expired or invalid",
              403,
              "SIGNED_URL_INVALID",
            );
          }
        } else {
          await runOptionalAuth(req, res);
          await assertRawStorageAccess(decoded, req.auth);
        }
      }

      let url = null;
      try {
        url = storage.publicUrl(decoded);
      } catch {
        url = null;
      }

      const selfFiles = (() => {
        if (!url) return true;
        try {
          const target = new URL(url);
          const api = new URL(env.apiUrl);
          return (
            target.host === api.host &&
            (target.pathname === "/files" ||
              target.pathname.startsWith("/files/"))
          );
        } catch {
          return false;
        }
      })();

      const unprefixed = stripStoragePrefix(decoded);
      const isStaffAvatarKey =
        unprefixed.startsWith("users/") ||
        unprefixed.startsWith("profile-images/");

      // Public marketing + staff avatars: redirect to CDN after ACL (avoids
      // cross-origin cookie issues on <img src="/files/...">).
      if (
        url &&
        !selfFiles &&
        (isPublicStorageKey(decoded) || isStaffAvatarKey)
      ) {
        res.setHeader("Cache-Control", "private, max-age=300");
        res.redirect(302, url);
        return;
      }

      if (url && !selfFiles && env.bunnyCdnTokenKey) {
        const signedUrl = await storage.createPresignedGetUrl(decoded);
        if (signedUrl) {
          res.setHeader("Cache-Control", "private, max-age=0, must-revalidate");
          res.redirect(302, signedUrl);
          return;
        }
      }

      const { stream, contentType, contentLength } =
        await storage.openReadStream(decoded);
      if (contentType) res.setHeader("Content-Type", contentType);
      if (contentLength != null) res.setHeader("Content-Length", contentLength);
      res.setHeader("Cache-Control", "private, max-age=300");
      stream.on("error", (err) => {
        if (!res.headersSent) {
          next(err);
          return;
        }
        res.destroy(err);
      });
      stream.pipe(res);
    } catch (err) {
      if (
        err?.statusCode === 404 ||
        err?.status === 404 ||
        err?.code === "NOT_FOUND"
      ) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "فایل یافت نشد" },
        });
        return;
      }
      next(err);
    }
  });

  app.use(globalLimiter);
  app.use(issueCsrf);

  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1/public", publicRoutes);
  app.use("/api/v1/crm", crmRoutes);
  app.use("/api/v1/portal", portalRoutes);
  app.use("/api/v1/projects", projectRoutes);
  app.use("/api/v1/ai", aiRoutes);
  app.use("/api/v1/delivery", deliveryRoutes);
  app.use("/api/v1/settings", settingsRoutes);
  app.use("/api/v1/permissions", permissionRoutes);
  app.use("/api/v1/employees", employeeRoutes);
  app.use("/api/v1/notifications", notificationRoutes);
  app.use("/api/v1/audit", auditRoutes);
  app.use("/api/v1/files", fileRoutes);
  app.use("/api/v1/narration", narrationRoutes);
  app.use("/api/v1/production", productionRoutes);
  app.use("/api/v1/portfolio", portfolioRoutes);
  app.use("/api/v1/backup", backupRoutes);
  app.use("/api/v1/services", servicesRoutes);
  app.use("/api/v1/contact", contactRoutes);
  app.use("/api/v1/hero", heroRoutes);
  app.use("/api/v1/customers", customersRoutes);
  app.use("/api/v1/finance", financeRoutes);
  app.use("/api/v1/chat", chatRoutes);
  app.use("/api/v1/sales-assistant", salesAssistantRoutes);
  app.use("/api/v1/business-assistant", businessAssistantRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
