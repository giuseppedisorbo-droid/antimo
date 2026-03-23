const CACHE_NAME = 'antimo-attivita-v49';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js?v=49',
  './global_notifications.js?v=49',
  './programmati.html',
  './programmati.js?v=49',
  './admin.html',
  './admin.js?v=49',
  './anagrafiche.html',
  './anagrafiche.js?v=49',
  './manifest.json'
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
    }).then(() => {
        self.clients.claim();
        // Forza l'aggiornamento immediato su tutte le finestre PWA aperte
        self.clients.matchAll({ type: 'window' }).then(windowClients => {
            windowClients.forEach(client => {
                client.navigate(client.url); // Questo forza il refresh "duro" iOS style
            });
        });
    }) 
  );
});

self.addEventListener('fetch', event => {
  // Ignora le richieste a Firebase e Autenticazione
  if (event.request.url.includes('firestore.googleapis.com') || 
      event.request.url.includes('firebasestorage.googleapis.com') ||
      event.request.url.includes('identitytoolkit.googleapis.com') ||
      event.request.url.includes('firebaseapp.com') ||
      event.request.url.includes('googleapis.com')) {
    return;
  }

  // Strategia globale NETWORK-FIRST per aggirare la cache aggressiva di iOS
  // Prima proviamo sempre a scaricare da internet, se fallisce (offline) usiamo la cache.
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Se la rete risponde, salviamo la nuova versione in cache e la ritorniamo
        return caches.open(CACHE_NAME).then(cache => {
          if (event.request.method === "GET" && !event.request.url.startsWith('chrome-extension')) {
            cache.put(event.request, response.clone());
          }
          return response;
        });
      })
      .catch(() => {
        // Se siamo offline (o c'è un errore di rete), peschiamo dalla cache
        return caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
                return cachedResponse;
            }
            // Fallback base se manca anche dalla cache (es. appena installata e offline)
            if (event.request.mode === 'navigate') {
                return caches.match('./index.html');
            }
        });
      })
  );
});
