const CACHE_NAME = 'antimo-attivita-v2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Cache aperta');
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
    })
  );
});

self.addEventListener('fetch', event => {
  // Ignoriamo le richieste a firebase (Firestore/Storage) per farle gestire dal loro SDK che ha già l'offline integrato
  if (event.request.url.includes('firestore.googleapis.com') || 
      event.request.url.includes('firebasestorage.googleapis.com') ||
      event.request.url.includes('identitytoolkit.googleapis.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Ritorna la risorsa dalla cache se c'è, altrimenti fai la fetch sulla rete
        return response || fetch(event.request).then(fetchRes => {
          return caches.open(CACHE_NAME).then(cache => {
            // Mettiamo in cache la nuova risorsa per i futuri offline
            if(event.request.method === "GET") {
              cache.put(event.request.url, fetchRes.clone());
            }
            return fetchRes;
          });
        });
      }).catch(() => {
        // Se non c'è rete e la risorsa non è in cache (fallback utile)
        if(event.request.destination === 'document') {
            return caches.match('./index.html');
        }
      })
  );
});
