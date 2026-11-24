// Minimal service worker: it exists so the site can be installed, and to show a friendly
// page when there is no connection. It deliberately caches NOTHING from the site itself:
// no pages, no /admin, no /api, no data. Only the offline page and the app icons.
const CACHE = "gw-offline-v3";
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
// Computers cut a long notification title, some of them without any "…", and how much fits
// depends on the system (these limits are estimates, in characters, for macOS and for
// Windows/Linux). So on a computer a long headline goes into the body, which wraps, and the
// title becomes a short label. Phones keep the headline as the title.
const DESKTOP_TITLE_LIMIT = { mac: 40, other: 55 };

function shapeText(data, title) {
	const body = data.body || "";
	const agent = self.navigator.userAgent;

	if (/Android|iPhone|iPad|iPod/.test(agent)) return { title, body };

	const mac = /Macintosh|Mac OS X/.test(agent);
	const limit = mac ? DESKTOP_TITLE_LIMIT.mac : DESKTOP_TITLE_LIMIT.other;

	if (
		typeof data.label !== "string" ||
		typeof data.headline !== "string" ||
		Array.from(title).length <= limit
	) {
		return { title, body };
	}

	const detail = typeof data.detail === "string" && data.detail ? `\n${data.detail}` : "";

	return { title: data.label, body: `${data.headline}${detail}` };
}

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

			// iPhone / iPad require a system notification for EVERY push (a push shown silently
			// gets the subscription cancelled after a few), so they always get one.
			const apple = /iPhone|iPad|iPod/.test(self.navigator.userAgent);

			if (visible.length > 0 && !apple) {
				for (const client of visible) {
					client.postMessage({ type: "gw-push", title, body: data.body || "", url });
				}

				return undefined;
			}

			const text = shapeText(data, title);

			return self.registration.showNotification(text.title, {
				body: text.body,
				icon: "/icons/icon-192.png",
				// the small status-bar icon: Android only reads the shape (alpha) of this image,
				// so it must be a single-colour picture, not the coloured logo
				badge: "/icons/badge-96.png",
				// a big picture under the text (the map or the article cover)
				image:
					typeof data.image === "string" && data.image.startsWith("https://")
						? data.image
						: undefined,
				vibrate: data.urgent ? [300, 120, 300, 120, 500] : [120, 60, 120],
				actions: [{ action: "open", title: "Άνοιγμα" }],
				lang: "el",
				tag: data.tag || undefined,
				renotify: Boolean(data.tag),
				// an emergency stays on screen until it is dismissed
				requireInteraction: data.urgent === true,
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
