// Minimal service worker: it exists so the site can be installed, and to show a friendly
// page when there is no connection. It deliberately caches NOTHING from the site itself:
// no pages, no /admin, no /api, no data. Only the offline page and the app icons.
const CACHE = "gw-offline-v1";
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
	event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
			.then(() => self.clients.claim()),
	);
});

self.addEventListener("fetch", (event) => {
	const { request } = event;

	// Only page navigations are touched, and only when the network fails.
	if (request.mode !== "navigate") return;

	event.respondWith(
		fetch(request).catch(async () => (await caches.match(OFFLINE_URL)) ?? Response.error()),
	);
});
