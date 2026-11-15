const CACHE_NAME = 'icefit-cache-v3';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './logo.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).catch(() => caches.match('./index.html'));
    })
  );
});

// ===== Notifica fine recupero =====
let restTimeout = null;
let restResolve = null;

async function fireRestNotification() {
  // Se l'app è aperta e visibile ci pensano beep e UI: niente notifica
  const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  if (list.some((c) => c.visibilityState === 'visible')) return;
  if (self.Notification && self.Notification.permission !== 'granted') return;
  await self.registration.showNotification('ICEFIT.', {
    body: 'Recupero terminato 💪 Pronto per la prossima serie',
    tag: 'icefit-rest',
    renotify: true,
    icon: 'logo.png',
    badge: 'logo.png',
    vibrate: [300, 150, 300]
  });
}

function clearRest() {
  clearTimeout(restTimeout);
  restTimeout = null;
  if (restResolve) { restResolve(); restResolve = null; }
}

self.addEventListener('message', (event) => {
  const d = event.data || {};
  if (d.type === 'cancel-rest') {
    clearRest();
    return;
  }
  if (d.type === 'schedule-rest') {
    clearRest();
    const endAt = Number(d.endAt) || 0;
    const delay = Math.max(0, endAt - Date.now());

    // Chrome Android (se supportato): notifica programmata dal sistema
    try {
      if ('showTrigger' in Notification.prototype && typeof TimestampTrigger !== 'undefined') {
        self.registration.showNotification('ICEFIT.', {
          body: 'Recupero terminato 💪 Pronto per la prossima serie',
          tag: 'icefit-rest',
          icon: 'logo.png',
          showTrigger: new TimestampTrigger(endAt)
        });
        return;
      }
    } catch (e) {}

    // Altrimenti: tiene vivo il service worker finché il browser lo permette
    event.waitUntil(new Promise((resolve) => {
      restResolve = resolve;
      restTimeout = setTimeout(async () => {
        restTimeout = null;
        restResolve = null;
        try { await fireRestNotification(); } catch (e) {}
        resolve();
      }, delay);
    }));
  }
});

// Notifica inviata dal server push (anche con app chiusa / telefono bloccato)
self.addEventListener('push', (event) => {
  event.waitUntil(
    self.registration.showNotification('ICEFIT.', {
      body: 'Recupero terminato 💪 Pronto per la prossima serie',
      tag: 'icefit-rest',
      renotify: true,
      icon: 'logo.png',
      badge: 'logo.png',
      vibrate: [300, 150, 300]
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return clients.openWindow('./index.html');
    })
  );
});
