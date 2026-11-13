// Minimal service worker: it exists so the site can be installed, and to show a friendly
// page when there is no connection. It deliberately caches NOTHING from the site itself:
// no pages, no /admin, no /api, no data. Only the offline page and the app icons.
const CACHE = "gw-offline-v2";
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

// ---- Push notifications ----------------------------------------------------------------
// The server sends {title, body, url, tag}. Only addresses of this site or https:// links
// are opened, whatever the message says.
self.addEventListener("push", (event) => {
	let data = {};

	try {
		data = event.data ? event.data.json() : {};
	} catch {
		data = {};
	}

	const title = data.title || "GreeceWeather";
	const url = data.url || "/";

	event.waitUntil(
		self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
			// The site is open and in front: show the message inside the page instead of a
			// system notification (browsers allow this for a visible page).
			const visible = windows.filter((client) => client.visibilityState === "visible");

			if (visible.length > 0) {
				for (const client of visible) {
					client.postMessage({ type: "gw-push", title, body: data.body || "", url });
				}

				return undefined;
			}

			return self.registration.showNotification(title, {
				body: data.body || "",
				icon: "/icons/icon-192.png",
				badge: "/icons/icon-192.png",
				lang: "el",
				tag: data.tag || undefined,
				renotify: Boolean(data.tag),
				// an emergency stays on screen until it is dismissed
				requireInteraction: typeof data.tag === "string" && data.tag.startsWith("emergency-"),
				timestamp: Date.now(),
				data: { url },
			});
		}),
	);
});

// The browser replaced the subscription (it expires or is refreshed): subscribe again with the
// same server key and tell the site, so the phone keeps getting notifications.
self.addEventListener("pushsubscriptionchange", (event) => {
	event.waitUntil(
		(async () => {
			const key = event.oldSubscription?.options?.applicationServerKey;

			if (!key) return;

			const subscription =
				event.newSubscription ||
				(await self.registration.pushManager.subscribe({
					userVisibleOnly: true,
					applicationServerKey: key,
				}));

			await fetch("/api/push/subscribe", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(subscription.toJSON()),
			});
		})().catch(() => {}),
	);
});

self.addEventListener("notificationclick", (event) => {
	event.notification.close();

	const raw = event.notification.data?.url || "/";
	const target = new URL(raw, self.location.origin);
	const url =
		target.origin === self.location.origin || target.protocol === "https:" ? target.href : "/";

	event.waitUntil(
		self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
			for (const client of windows) {
				if (client.url === url && "focus" in client) return client.focus();
			}

			return self.clients.openWindow(url);
		}),
	);
});
