/* APEX Web Push service worker — keep this file at /sw.js (public root). */
/* eslint-disable no-restricted-globals */

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(Promise.resolve());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function asAbsoluteUrl(url) {
  try {
    return new URL(url, self.location.origin).href;
  } catch {
    return self.location.origin;
  }
}

self.addEventListener("push", (event) => {
  let data = {
    title: "اعلان جدید",
    body: "",
    url: "/",
    tag: "apex-notification",
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch {
    try {
      const text = event.data ? event.data.text() : "";
      if (text) data.body = text;
    } catch {
      // ignore malformed payloads
    }
  }

  const title = data.title || "اعلان جدید";
  const options = {
    body: data.body || "",
    dir: "rtl",
    lang: "fa",
    icon: "/brand/favicon/android-chrome-192x192.png",
    badge: "/brand/favicon/android-chrome-192x192.png",
    tag: data.tag || "apex-notification",
    renotify: true,
    data: {
      url: asAbsoluteUrl(data.url || "/"),
      notificationId: data.notificationId || null,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = asAbsoluteUrl(
    (event.notification.data && event.notification.data.url) || "/",
  );

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of allClients) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(targetUrl);
              return;
            } catch {
              // fall through to openWindow
            }
          }
          return;
        }
      }

      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })(),
  );
});
