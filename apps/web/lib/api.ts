import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";
import {
  AUTH_PANEL_HEADER,
  resolveClientAuthPanel,
  type AuthPanel,
} from "@/lib/auth-panel";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

/** Public file CDN / local static mount (no trailing slash). */
export const STORAGE_PUBLIC_BASE = (
  process.env.NEXT_PUBLIC_STORAGE_PUBLIC_BASE ||
  API_BASE.replace(/\/api\/v1\/?$/, "") + "/files"
).replace(/\/$/, "");

function isAbsoluteHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

/** Extract upload-time CDN URL from asset meta when present. */
export function storedAssetUrlFromMeta(meta: unknown): string | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const root = meta as Record<string, unknown>;
  const storage =
    root.storage && typeof root.storage === "object" && !Array.isArray(root.storage)
      ? (root.storage as Record<string, unknown>)
      : null;
  const candidates = [
    storage?.url,
    storage?.secureUrl,
    storage?.secure_url,
    root.url,
    root.secureUrl,
    root.secure_url,
    root.imageUrl,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && isAbsoluteHttpUrl(value)) {
      return value.trim();
    }
  }
  return null;
}

export function storagePublicUrl(storageKey: string): string | null {
  if (!storageKey || storageKey.startsWith("ref://")) return null;
  if (isAbsoluteHttpUrl(storageKey)) return storageKey.trim();
  const encoded = storageKey
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `${STORAGE_PUBLIC_BASE}/${encoded}`;
}

/**
 * Canonical frontend asset src resolver.
 * Prefer absolute/stored CDN URLs; fall back to /files/<key> redirect shim.
 */
export function resolveAssetSrc(input: {
  url?: string | null;
  previewUrl?: string | null;
  imageUrl?: string | null;
  storageKey?: string | null;
  meta?: unknown;
} | null | undefined): string | null {
  if (!input) return null;
  for (const value of [input.url, input.previewUrl, input.imageUrl]) {
    if (typeof value === "string" && isAbsoluteHttpUrl(value)) {
      return value.trim();
    }
  }
  const fromMeta = storedAssetUrlFromMeta(input.meta);
  if (fromMeta) return fromMeta;
  return storagePublicUrl(input.storageKey || "");
}

export const CSRF_COOKIE = "apex_csrf";

/**
 * In-memory CSRF token from GET /auth/csrf.
 * Required for cross-origin (Vercel → Railway): the CSRF cookie is scoped to the
 * API host, so document.cookie on the web origin cannot read it.
 */
let csrfTokenMemory: string | null = null;

export interface ApiEnvelope<T = unknown> {
  success: boolean;
  data?: T;
  meta?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(message: string, status = 400, code = "APP_ERROR", details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function getCsrfToken(): string | null {
  if (csrfTokenMemory) return csrfTokenMemory;
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${CSRF_COOKIE}=([^;]*)`)
  );
  return match ? decodeURIComponent(match[1]) : null;
}

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  timeout: 20 * 60 * 1000,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const panel = resolveClientAuthPanel();
  if (panel) {
    config.headers.set(AUTH_PANEL_HEADER, panel);
  }

  const method = config.method?.toUpperCase();
  if (method && !["GET", "HEAD", "OPTIONS"].includes(method)) {
    const csrf = getCsrfToken();
    if (csrf) {
      config.headers.set("X-CSRF-Token", csrf);
    }
  }
  return config;
});

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  const ax = error as AxiosError<ApiEnvelope>;
  const status = ax.response?.status ?? 500;
  const payload = ax.response?.data;
  const message =
    payload?.error?.message ||
    (status === 409
      ? "این رکورد تکراری است"
      : ax.message || "درخواست ناموفق بود");
  return new ApiError(
    message,
    status,
    payload?.error?.code || "REQUEST_FAILED",
    payload?.error?.details
  );
}

type RetryConfig = AxiosRequestConfig & { _retry?: boolean };

/** Per-panel refresh locks so Manager/Editor/Portal tabs never rotate each other’s tokens. */
const refreshPromises = new Map<string, Promise<boolean>>();

async function silentRefresh(panel?: AuthPanel | null): Promise<boolean> {
  const activePanel = panel ?? resolveClientAuthPanel();
  const key = activePanel || "_default";

  const existing = refreshPromises.get(key);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const headers: Record<string, string> = {};
      if (activePanel) headers[AUTH_PANEL_HEADER] = activePanel;

      const { data } = await axios.post<ApiEnvelope<{ refreshed: boolean }>>(
        `${API_BASE}/auth/refresh`,
        {},
        { withCredentials: true, headers }
      );
      return !!data.success;
    } catch {
      return false;
    } finally {
      refreshPromises.delete(key);
    }
  })();

  refreshPromises.set(key, promise);
  return promise;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiEnvelope>) => {
    const original = error.config as RetryConfig | undefined;
    const status = error.response?.status;
    const url = original?.url || "";

    const isAuthEndpoint =
      url.includes("/auth/refresh") ||
      url.includes("/auth/login") ||
      url.includes("/auth/portal/login") ||
      url.includes("/auth/logout");

    if (status === 401 && original && !original._retry && !isAuthEndpoint) {
      original._retry = true;
      const panelHeader = original.headers
        ? String(
            (original.headers as Record<string, string>)[AUTH_PANEL_HEADER] ||
              (original.headers as { get?: (k: string) => string }).get?.(
                AUTH_PANEL_HEADER
              ) ||
              ""
          )
        : "";
      const panel = (panelHeader || resolveClientAuthPanel()) as AuthPanel | null;
      const refreshed = await silentRefresh(panel);
      if (refreshed) {
        return api.request(original);
      }
    }

    return Promise.reject(toApiError(error));
  }
);

export async function ensureCsrf(): Promise<void> {
  const { data } = await api.get<ApiEnvelope<{ csrfToken: string }>>("/auth/csrf");
  const token = data?.data?.csrfToken;
  if (token) csrfTokenMemory = token;
}

export async function apiGet<T>(url: string): Promise<T> {
  const { data } = await api.get<ApiEnvelope<T>>(url);
  if (!data.success) {
    throw new ApiError(
      data.error?.message || "درخواست ناموفق بود",
      400,
      data.error?.code || "APP_ERROR",
      data.error?.details
    );
  }
  return data.data as T;
}

export async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  await ensureCsrf();
  const { data } = await api.post<ApiEnvelope<T>>(url, body);
  if (!data.success) {
    throw new ApiError(
      data.error?.message || "درخواست ناموفق بود",
      400,
      data.error?.code || "APP_ERROR",
      data.error?.details
    );
  }
  return data.data as T;
}

export async function apiPatch<T>(url: string, body?: unknown): Promise<T> {
  await ensureCsrf();
  const { data } = await api.patch<ApiEnvelope<T>>(url, body);
  if (!data.success) {
    throw new ApiError(
      data.error?.message || "درخواست ناموفق بود",
      400,
      data.error?.code || "APP_ERROR",
      data.error?.details
    );
  }
  return data.data as T;
}

export async function apiDelete<T>(url: string): Promise<T> {
  await ensureCsrf();
  const { data } = await api.delete<ApiEnvelope<T>>(url);
  if (!data.success) {
    throw new ApiError(
      data.error?.message || "درخواست ناموفق بود",
      400,
      data.error?.code || "APP_ERROR",
      data.error?.details
    );
  }
  return data.data as T;
}

export async function apiPut<T>(url: string, body?: unknown): Promise<T> {
  await ensureCsrf();
  const { data } = await api.put<ApiEnvelope<T>>(url, body);
  if (!data.success) {
    throw new ApiError(
      data.error?.message || "درخواست ناموفق بود",
      400,
      data.error?.code || "APP_ERROR",
      data.error?.details
    );
  }
  return data.data as T;
}

export { API_BASE, silentRefresh };
