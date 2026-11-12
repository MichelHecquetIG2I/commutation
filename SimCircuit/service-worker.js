const CACHE_NAME = 'simcircuit-shell-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './apple-touch-icon.png',
  './favicon-32.png',
  './favicon.ico',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
      .catch(error => {
        console.error('Impossible de mettre en cache l’application Commutation.', error);
        throw error;
      })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith('simcircuit-shell-') && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(response => {
        if (!response.ok) return response;
        return caches.open(CACHE_NAME).then(cache =>
          cache.put(request, response.clone())
            .then(() => response)
            .catch(error => {
              console.error('Impossible d’actualiser le cache de Commutation.', error);
              return response;
            })
        );
      }, error => {
        console.warn('Réseau indisponible, ouverture de la version hors ligne.', error);
        return caches.match(request).then(cached =>
          cached || caches.match(new URL('./index.html', self.registration.scope))
        );
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request))
  );
});
