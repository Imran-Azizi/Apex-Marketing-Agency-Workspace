import { AppError } from "../utils/response.js";
import { env } from "../config/env.js";

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err instanceof AppError) {
    return res.status(err.status).json({
      success: false,
      error: { code: err.code, message: err.message, details: err.details },
    });
  }

  if (err.name === "ZodError") {
    const first = err.errors?.[0];
    const field = first?.path?.join(".") || "";
    const msg = first?.message || "Validation failed";
    return res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: field ? `${field}: ${msg}` : msg,
        details: err.errors,
      },
    });
  }

  console.error("[API Error]", err);
  const message =
    env.nodeEnv === "production"
      ? "Internal server error"
      : err?.message || "Internal server error";
  return res.status(500).json({
    success: false,
    error: { code: "INTERNAL_ERROR", message },
  });
}

export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: `Route not found: ${req.method} ${req.path}`,
    },
  });
}
