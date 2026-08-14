/* global self */

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const notification = payload.notification || {};
  const data = payload.data || {};
  const title = notification.title || data.title || 'Sahay notification';
  const options = {
    body: notification.body || data.body || '',
    data: {
      actionUrl: data.actionUrl || '/',
      notificationId: data.notificationId || '',
    },
    tag: data.notificationId || undefined,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification?.data?.actionUrl || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const origin = self.location.origin;
      const targetUrl = new URL(url, origin).href;
      const visibleClient = clients.find((client) => client.url.startsWith(origin) && 'focus' in client);
      if (visibleClient) {
        visibleClient.navigate(targetUrl);
        return visibleClient.focus();
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
