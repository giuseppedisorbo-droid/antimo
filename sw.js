const CACHE_NAME = 'antimo-attivita-v4';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap'
];

self.addEventListener('install', event => {
  self.skipWaiting(); // Forza il nuovo SW a prendere subito il controllo
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Cache aperta:', CACHE_NAME);
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(name => {
          if (name !== CACHE_NAME) {
            console.log('Cache vecchia eliminata:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim()) // Prende il controllo delle pagine aperte
  );
});

self.addEventListener('fetch', event => {
  // Ignora le richieste a Firebase
  if (event.request.url.includes('firestore.googleapis.com') || 
      event.request.url.includes('firebasestorage.googleapis.com') ||
      event.request.url.includes('identitytoolkit.googleapis.com')) {
    return;
  }

  // Strategia Network-First per HTML (Per aggiornare la PWA velocemente)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
           return caches.open(CACHE_NAME).then(cache => {
             cache.put(event.request, response.clone());
             return response;
           });
        })
        .catch(() => {
           return caches.match('./index.html'); // Offline Fallback
        })
    );
    return;
  }

  // Risorse statiche (JS, CSS, Immagini) -> Cache-First
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request).then(fetchRes => {
          return caches.open(CACHE_NAME).then(cache => {
            if(event.request.method === "GET" && !event.request.url.startsWith('chrome-extension')) {
              cache.put(event.request.url, fetchRes.clone());
            }
            return fetchRes;
          });
        });
      })
  );
});
