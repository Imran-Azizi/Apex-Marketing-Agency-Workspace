import axios, { type AxiosError } from "axios";
import {
  AUTH_PANEL_HEADER,
  resolveClientAuthPanel,
  type AuthPanel,
} from "@/lib/auth-panel";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

/** Skip redundant refresh when another tab rotated tokens moments ago. */
const REFRESH_COOLDOWN_MS = 90_000;
const REFRESH_MARKER_PREFIX = "apex_last_refresh_";
const REFRESH_LOCK_PREFIX = "apex-auth-refresh";
const STORAGE_LOCK_PREFIX = "apex_refresh_lock_";
const STORAGE_LOCK_TTL_MS = 30_000;

type RefreshEnvelope = {
  success: boolean;
  data?: { refreshed: boolean };
  error?: { code?: string };
};

/** Per-tab dedupe — multiple callers in the same tab share one in-flight refresh. */
const inTabRefreshPromises = new Map<string, Promise<boolean>>();

function refreshKey(panel: AuthPanel | null): string {
  return panel || "_default";
}

function markerStorageKey(key: string): string {
  return `${REFRESH_MARKER_PREFIX}${key}`;
}

export function wasRecentlyRefreshed(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(markerStorageKey(key));
    if (!raw) return false;
    const at = Number(raw);
    return Number.isFinite(at) && Date.now() - at < REFRESH_COOLDOWN_MS;
  } catch {
    return false;
  }
}

function markRefreshed(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(markerStorageKey(key), String(Date.now()));
  } catch {
    /* private mode / blocked storage */
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function callRefreshEndpoint(
  activePanel: AuthPanel | null,
  attempt = 0,
): Promise<boolean> {
  try {
    const headers: Record<string, string> = {};
    if (activePanel) headers[AUTH_PANEL_HEADER] = activePanel;

    const { data } = await axios.post<RefreshEnvelope>(
      `${API_BASE}/auth/refresh`,
      {},
      { withCredentials: true, headers },
    );
    return !!data.success;
  } catch (err) {
    const ax = err as AxiosError<RefreshEnvelope>;
    const code = ax.response?.data?.error?.code;
    // Another tab rotated the refresh token — cookies are already updated; retry once.
    if (attempt < 2 && code === "TOKEN_ROTATED") {
      await sleep(120 * (attempt + 1));
      return callRefreshEndpoint(activePanel, attempt + 1);
    }
    return false;
  }
}

function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  try {
    return new BroadcastChannel("apex-auth-refresh");
  } catch {
    return null;
  }
}

async function refreshWithStorageLock(
  key: string,
  work: () => Promise<boolean>,
): Promise<boolean> {
  const lockKey = `${STORAGE_LOCK_PREFIX}${key}`;
  const channel = getBroadcastChannel();
  const now = Date.now();

  try {
    const held = localStorage.getItem(lockKey);
    if (held && now - Number(held) < STORAGE_LOCK_TTL_MS) {
      return new Promise((resolve) => {
        let settled = false;
        const finish = (value: boolean) => {
          if (settled) return;
          settled = true;
          channel?.removeEventListener("message", onMessage);
          window.clearTimeout(timer);
          resolve(value);
        };

        const onMessage = (event: MessageEvent) => {
          const payload = event.data as { type?: string; key?: string } | null;
          if (payload?.type === "done" && payload.key === key) {
            finish(wasRecentlyRefreshed(key));
          }
        };

        channel?.addEventListener("message", onMessage);
        const timer = window.setTimeout(
          () => finish(wasRecentlyRefreshed(key)),
          STORAGE_LOCK_TTL_MS,
        );
      });
    }

    localStorage.setItem(lockKey, String(now));
    const result = await work();
    channel?.postMessage({ type: "done", key, ok: result });
    return result;
  } catch {
    return work();
  } finally {
    try {
      localStorage.removeItem(lockKey);
    } catch {
      /* ignore */
    }
  }
}

async function refreshWithCrossTabLock(
  key: string,
  activePanel: AuthPanel | null,
): Promise<boolean> {
  const work = async (): Promise<boolean> => {
    if (wasRecentlyRefreshed(key)) return true;
    const ok = await callRefreshEndpoint(activePanel);
    if (ok) markRefreshed(key);
    return ok;
  };

  const lockName = `${REFRESH_LOCK_PREFIX}:${key}`;

  if (typeof navigator !== "undefined" && navigator.locks?.request) {
    try {
      return await navigator.locks.request(lockName, work);
    } catch {
      /* fall through to storage lock */
    }
  }

  return refreshWithStorageLock(key, work);
}

/**
 * Renew the access token for this tab's panel without navigation.
 * Coordinates across browser tabs so concurrent refreshes never revoke the session.
 */
export async function silentRefresh(panel?: AuthPanel | null): Promise<boolean> {
  const activePanel = panel ?? resolveClientAuthPanel();
  const key = refreshKey(activePanel);

  const existing = inTabRefreshPromises.get(key);
  if (existing) return existing;

  const promise = refreshWithCrossTabLock(key, activePanel).finally(() => {
    inTabRefreshPromises.delete(key);
  });

  inTabRefreshPromises.set(key, promise);
  return promise;
}
