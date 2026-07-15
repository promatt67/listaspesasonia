const CACHE_NAME = "lista-spesa-sonia-v2"; // Aggiornato a v2 per forzare il reset sui telefoni
const urlsToCache = [
    "./", 
    "./index.html", 
    "./app.js", 
    "./manifest.json"
];

// 1. Installazione: Salva i file di base nella cache del dispositivo
self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(urlsToCache);
        })
    );
    self.skipWaiting();
});

// 2. Attivazione: Elimina le vecchie cache per non intasare la memoria
self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            )
        )
    );
    self.clients.claim();
});

// 3. Gestione Richieste (FETCH): Il cuore dell'offline
self.addEventListener("fetch", event => {
    // Ignora le richieste destinate a Firebase (lasciamo che se ne occupi l'SDK offline di Firebase)
    if (event.request.url.includes("firebase") || event.request.url.includes("googleapis")) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then(cached => {
            // Se il file è in cache, lo restituisce subito
            if (cached) return cached;
            
            // Altrimenti va a prenderselo su internet
            return fetch(event.request).catch(() => {
                // Se internet non va, restituisce la pagina principale
                return caches.match("./index.html");
            });
        })
    );
});
