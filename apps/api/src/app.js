import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { globalLimiter } from "./middleware/rateLimit.js";
import { issueCsrf } from "./middleware/csrf.js";
import { normalizeDigitsMiddleware } from "./middleware/normalizeDigits.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

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
import { storage } from "./services/storage.js";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      contentSecurityPolicy: false,
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
      allowedHeaders: ["Content-Type", "X-CSRF-Token", "X-APEX-Panel", "Range"],
      exposedHeaders: [
        "Content-Range",
        "Accept-Ranges",
        "Content-Length",
        "Content-Type",
      ],
    }),
  );
  // Health must stay before rate-limit / CSRF so Railway probes always succeed.
  app.get("/health", (req, res) => {
    res.status(200).json({
      success: true,
      data: {
        status: "ok",
        service: "apex-api",
        time: new Date().toISOString(),
        storage: env.storageDriver,
      },
    });
  });

  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  // Convert Persian/Arabic-Indic digits → English before any route logic
  app.use(normalizeDigitsMiddleware);
  app.use(globalLimiter);
  app.use(issueCsrf);

  // /files/<key> → resolved Cloudinary / R2 / S3 URL (compatibility for frontend previews)
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
      const decoded = decodeURIComponent(key);
      const url = await storage.resolveDeliveryUrl(decoded);
      res.redirect(302, url);
    } catch (err) {
      if (err?.statusCode === 404 || err?.code === "NOT_FOUND") {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "فایل یافت نشد" },
        });
        return;
      }
      next(err);
    }
  });

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

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
