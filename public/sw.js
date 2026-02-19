self.addEventListener("install", (event) => {
  // Activate the updated service worker as soon as it's installed.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  const payload = (() => {
    try {
      return event.data ? event.data.json() : null;
    } catch {
      return event.data ? { title: "RideShare", body: event.data.text() } : null;
    }
  })();

  const title = payload?.title || "RideShare";
  const body = payload?.body || "You have a new notification.";
  const url = payload?.url || "/";

  const options = {
    body,
    icon: payload?.icon || "/android-chrome-192.png",
    badge: payload?.badge || "/favicon-32.png",
    data: { url },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification?.data?.url || "/";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = allClients.find((c) => c.url && new URL(c.url).pathname === url);
      if (existing) {
        await existing.focus();
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
