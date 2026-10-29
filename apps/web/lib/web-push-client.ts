import { apiDelete, apiGet, apiPost } from "@/lib/api";

const SW_PATH = "/sw.js";
const SW_SCOPE = "/";

export type WebPushStatus = {
  configured: boolean;
  subscribed: boolean;
  deviceCount: number;
  permission: NotificationPermission | "unsupported";
  /**
   * Extra hint when push APIs are missing.
   * iOS Safari/Chrome in a normal tab never expose PushManager — only a
   * Home Screen (standalone) install does, on iOS 16.4+.
   */
  unsupportedReason?: "ios-home-screen-required" | "browser";
};

/** iPhone / iPad (including iPadOS desktop UA). */
export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  // iPadOS 13+ may report as Mac with touch
  return (
    navigator.platform === "MacIntel" &&
    typeof navigator.maxTouchPoints === "number" &&
    navigator.maxTouchPoints > 1
  );
}

/** True when launched from Home Screen / installed PWA. */
export function isStandaloneDisplayMode(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia?.("(display-mode: standalone)");
  if (mq?.matches) return true;
  // Legacy iOS Safari
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export function isWebPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function registerApexServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isWebPushSupported()) return null;
  try {
    return await navigator.serviceWorker.register(SW_PATH, { scope: SW_SCOPE });
  } catch (err) {
    console.warn("[web-push] service worker register failed", err);
    return null;
  }
}

async function getReadyRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!isWebPushSupported()) return null;
  const existing = await navigator.serviceWorker.getRegistration(SW_SCOPE);
  if (existing) return existing;
  return registerApexServiceWorker();
}

export async function fetchPushServerStatus(): Promise<{
  configured: boolean;
  subscribed: boolean;
  deviceCount: number;
}> {
  const data = await apiGet<{
    configured: boolean;
    subscribed: boolean;
    deviceCount: number;
  }>("/notifications/push/status");
  return {
    configured: Boolean(data.configured),
    subscribed: Boolean(data.subscribed),
    deviceCount: Number(data.deviceCount || 0),
  };
}

export async function getLocalWebPushStatus(): Promise<WebPushStatus> {
  if (!isWebPushSupported()) {
    const iosNeedsHomeScreen = isIosDevice() && !isStandaloneDisplayMode();
    return {
      configured: false,
      subscribed: false,
      deviceCount: 0,
      permission: "unsupported",
      unsupportedReason: iosNeedsHomeScreen
        ? "ios-home-screen-required"
        : "browser",
    };
  }

  const permission = Notification.permission;
  let server = {
    configured: false,
    subscribed: false,
    deviceCount: 0,
  };
  try {
    server = await fetchPushServerStatus();
  } catch {
    // offline / not logged in yet
  }

  return {
    ...server,
    permission,
  };
}

async function getVapidPublicKey(): Promise<string | null> {
  const data = await apiGet<{ configured: boolean; publicKey: string | null }>(
    "/notifications/push/vapid-public-key",
  );
  if (!data.configured || !data.publicKey) return null;
  return data.publicKey;
}

function serializeSubscription(sub: PushSubscription) {
  const json = sub.toJSON();
  return {
    endpoint: json.endpoint || sub.endpoint,
    keys: {
      p256dh: json.keys?.p256dh || "",
      auth: json.keys?.auth || "",
    },
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
  };
}

/**
 * Ask for permission (if needed), create a browser subscription, and store it on the API.
 */
export async function enableWebPush(): Promise<WebPushStatus> {
  if (!isWebPushSupported()) {
    if (isIosDevice() && !isStandaloneDisplayMode()) {
      throw new Error(
        "در آیفون ابتدا سایت را با Safari به صفحه اصلی اضافه کنید، سپس از همان آیکون باز کنید و اعلان را فعال کنید",
      );
    }
    throw new Error("این مرورگر از اعلان خارج از برنامه پشتیبانی نمی‌کند");
  }

  const registration = await getReadyRegistration();
  if (!registration) {
    throw new Error("ثبت Service Worker ناموفق بود");
  }

  const permission =
    Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();

  if (permission !== "granted") {
    throw new Error("اجازه اعلان داده نشد");
  }

  const publicKey = await getVapidPublicKey();
  if (!publicKey) {
    throw new Error("اعلان خارج از برنامه روی سرور پیکربندی نشده است");
  }

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });
  }

  const payload = serializeSubscription(subscription);
  if (!payload.endpoint || !payload.keys.p256dh || !payload.keys.auth) {
    throw new Error("اشتراک Push نامعتبر است");
  }

  await apiPost("/notifications/push/subscribe", payload);
  return getLocalWebPushStatus();
}

/**
 * Remove the current browser subscription from the API (and unsubscribe locally when possible).
 */
export async function disableWebPush(): Promise<WebPushStatus> {
  if (!isWebPushSupported()) {
    return getLocalWebPushStatus();
  }

  const registration = await getReadyRegistration();
  const subscription = registration
    ? await registration.pushManager.getSubscription()
    : null;

  if (subscription) {
    try {
      await apiPost("/notifications/push/unsubscribe", {
        endpoint: subscription.endpoint,
      });
    } catch {
      try {
        await apiDelete(
          `/notifications/push/subscribe?endpoint=${encodeURIComponent(subscription.endpoint)}`,
        );
      } catch {
        // continue local unsubscribe
      }
    }
    try {
      await subscription.unsubscribe();
    } catch {
      // ignore
    }
  }

  return getLocalWebPushStatus();
}

/**
 * If the user already granted permission, keep the server subscription in sync.
 * Safe to call on every authenticated page load.
 */
export async function syncWebPushSubscription(): Promise<void> {
  if (!isWebPushSupported()) return;
  if (Notification.permission !== "granted") return;

  try {
    const registration = await getReadyRegistration();
    if (!registration) return;

    const publicKey = await getVapidPublicKey();
    if (!publicKey) return;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
    }

    const payload = serializeSubscription(subscription);
    if (!payload.endpoint || !payload.keys.p256dh || !payload.keys.auth) return;
    await apiPost("/notifications/push/subscribe", payload);
  } catch (err) {
    console.warn("[web-push] sync failed", err);
  }
}
