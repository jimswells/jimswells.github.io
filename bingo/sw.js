  // sw.js
  const CACHE = 'destiny-bingo-v2';
  const APP_SHELL_KEY = 'app-shell';

  self.addEventListener('install', event => {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE);
      try {
        // Pre-cache the current HTML as the app shell
        const resp = await fetch(self.registration.scope, { cache: 'reload' });
        await cache.put(APP_SHELL_KEY, resp.clone());
      } catch (e) {
        // first load might be offline — that's okay, we'll cache on first successful fetch
      }
      self.skipWaiting();
    })());
  });

  self.addEventListener('activate', event => {
    event.waitUntil((async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
      await self.clients.claim();
    })());
  });

  self.addEventListener('fetch', event => {
    const req = event.request;
    if (req.mode === 'navigate') {
      event.respondWith((async () => {
        try {
          const net = await fetch(req);
          const cache = await caches.open(CACHE);
          // refresh app shell on successful navigation
          cache.put(APP_SHELL_KEY, net.clone());
          return net;
        } catch (e) {
          const cache = await caches.open(CACHE);
          const cached = await cache.match(APP_SHELL_KEY);
          if (cached) return cached;
          return new Response('<!doctype html><title>Offline</title><h1>Offline</h1><p>Visit once while online to enable offline mode.</p>', { headers: { 'Content-Type': 'text/html' } });
        }
      })());
      return;
    }

    // Same-origin runtime cache: cache-first, then network, fallback to cache
    const url = new URL(req.url);
    if (url.origin === self.location.origin) {
      event.respondWith((async () => {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(req, { ignoreSearch: true });
        if (cached) return cached;
        try {
          const net = await fetch(req);
          cache.put(req, net.clone());
          return net;
        } catch (e) {
          return cached || Response.error();
        }
      })());
    }
  });