"use client";

import { useEffect, useSyncExternalStore } from "react";

// Everything the browser side of notifications needs, in one place: the state of the
// permission and of the subscription, turning them on and off, a test message, and the small
// stores behind the guide and the in-app messages (components/NotificationGuide.tsx).

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const WAS_ON = "gw-push-was-on";

export type PushState =
	| "checking"
	| "unsupported"
	| "ios-install"
	| "off"
	| "on"
	| "denied"
	| "busy";

export type Platform = {
	os: "ios" | "android" | "mac" | "windows" | "other";
	browser: "chrome" | "edge" | "firefox" | "safari" | "samsung" | "other";
	/** opened from the home screen (installed app) rather than a browser tab */
	standalone: boolean;
};

// ---- a tiny store, so every button and the guide see the same thing -----------------------

function createStore<T>(initial: T) {
	let value = initial;
	const listeners = new Set<() => void>();

	return {
		get: () => value,
		set(next: T) {
			value = next;

			for (const listener of listeners) listener();
		},
		subscribe(listener: () => void) {
			listeners.add(listener);

			return () => {
				listeners.delete(listener);
			};
		},
	};
}

const stateStore = createStore<PushState>("checking");
const errorStore = createStore("");

function setState(next: PushState, error = "") {
	errorStore.set(error);
	stateStore.set(next);
}

// ---- helpers -------------------------------------------------------------------------------

export function detectPlatform(): Platform {
	if (typeof navigator === "undefined") {
		return { os: "other", browser: "other", standalone: false };
	}

	const ua = navigator.userAgent;
	const ios =
		/iPad|iPhone|iPod/.test(ua) ||
		(navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

	const os: Platform["os"] = ios
		? "ios"
		: /Android/i.test(ua)
			? "android"
			: /Mac/i.test(ua)
				? "mac"
				: /Windows/i.test(ua)
					? "windows"
					: "other";

	const browser: Platform["browser"] = /SamsungBrowser/i.test(ua)
		? "samsung"
		: /Edg\//.test(ua)
			? "edge"
			: /Firefox|FxiOS/.test(ua)
				? "firefox"
				: /Chrome|CriOS/.test(ua)
					? "chrome"
					: /Safari/.test(ua)
						? "safari"
						: "other";

	const standalone =
		window.matchMedia?.("(display-mode: standalone)").matches ||
		(navigator as Navigator & { standalone?: boolean }).standalone === true;

	return { os, browser, standalone };
}

function keyToBytes(base64url: string) {
	const padded = base64url
		.replace(/-/g, "+")
		.replace(/_/g, "/")
		.padEnd(Math.ceil(base64url.length / 4) * 4, "=");

	return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

function sameKey(subscription: PushSubscription) {
	const have = subscription.options?.applicationServerKey;

	if (!have || !PUBLIC_KEY) return true;

	const a = new Uint8Array(have);
	const b = keyToBytes(PUBLIC_KEY);

	return a.length === b.length && a.every((byte, i) => byte === b[i]);
}

function remember(on: boolean) {
	try {
		if (on) localStorage.setItem(WAS_ON, "1");
		else localStorage.removeItem(WAS_ON);
	} catch {}
}

export function wasOn(): boolean {
	try {
		return localStorage.getItem(WAS_ON) === "1";
	} catch {
		return false;
	}
}

async function post(path: string, body: unknown) {
	return fetch(path, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

// The service worker is only registered in production; without it `ready` never answers.
function readyRegistration(): Promise<ServiceWorkerRegistration> {
	return Promise.race([
		navigator.serviceWorker.ready,
		new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("no-sw")), 6000)),
	]);
}

async function subscribeNow(registration: ServiceWorkerRegistration) {
	if (!PUBLIC_KEY) throw new Error("no-key");

	return registration.pushManager.subscribe({
		userVisibleOnly: true,
		applicationServerKey: keyToBytes(PUBLIC_KEY),
	});
}

// ---- checking the situation ------------------------------------------------------------------

let started = false;
let refreshing = false;

function supported() {
	return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** Looks at the permission and the subscription again and updates every button. */
export async function refreshPush() {
	if (refreshing) return;

	refreshing = true;

	try {
		if (!PUBLIC_KEY) {
			setState("unsupported");
			return;
		}

		if (!supported()) {
			setState(detectPlatform().os === "ios" ? "ios-install" : "unsupported");
			return;
		}

		if (Notification.permission === "denied") {
			setState("denied");
			return;
		}

		const registration = await readyRegistration();
		let subscription = await registration.pushManager.getSubscription();

		// The server key changed since this phone subscribed: the old subscription can never
		// receive anything again, so it is replaced quietly.
		if (subscription && !sameKey(subscription)) {
			await subscription.unsubscribe().catch(() => {});
			subscription = null;

			if (Notification.permission === "granted") {
				subscription = await subscribeNow(registration).catch(() => null);
			}
		}

		// Notifications were on, the browser dropped the subscription, the permission is still
		// there: subscribe again without asking anything.
		if (!subscription && Notification.permission === "granted" && wasOn()) {
			subscription = await subscribeNow(registration).catch(() => null);
		}

		if (subscription) {
			const response = await post("/api/push/subscribe", subscription.toJSON()).catch(() => null);

			// keeps the server's copy up to date
			if (response && !response.ok && response.status >= 400 && response.status < 500) {
				setState("off", "Η συσκευή δεν καταχωρήθηκε στον server. Δοκίμασε ξανά.");
				return;
			}

			remember(true);
			setState("on");
		} else {
			setState("off");
		}
	} catch {
		setState("unsupported");
	} finally {
		refreshing = false;
	}
}

function start() {
	if (started) return;

	started = true;
	void refreshPush();

	// Coming back from the phone's settings (or changing the permission from the address bar)
	// is noticed straight away, with no page reload.
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "visible") void refreshPush();
	});

	navigator.permissions
		?.query({ name: "notifications" })
		.then((status) => {
			status.onchange = () => void refreshPush();
		})
		.catch(() => {});
}

// ---- actions ----------------------------------------------------------------------------------

export async function enablePush() {
	if (!PUBLIC_KEY) return;

	setState("busy");

	try {
		const permission = await Notification.requestPermission();

		if (permission !== "granted") {
			setState(permission === "denied" ? "denied" : "off");

			// the visitor said no (or the browser did): show how to change that
			if (permission === "denied") openGuide("denied");

			return;
		}

		const registration = await readyRegistration();
		const subscription =
			(await registration.pushManager.getSubscription()) ?? (await subscribeNow(registration));

		const response = await post("/api/push/subscribe", subscription.toJSON());

		if (!response.ok) {
			// the phone is subscribed but the site could not save it: undo, so nothing is half-done
			await subscription.unsubscribe().catch(() => {});
			throw new Error(`ο server απάντησε ${response.status}`);
		}

		remember(true);
		setState("on");
		announceEnabled();
	} catch (error) {
		setState(
			"off",
			`Δεν ήταν δυνατή η ενεργοποίηση (${error instanceof Error ? error.message : "άγνωστο σφάλμα"}).`,
		);
	}
}

export async function disablePush() {
	setState("busy");

	try {
		const registration = await readyRegistration();
		const subscription = await registration.pushManager.getSubscription();

		if (subscription) {
			await post("/api/push/unsubscribe", subscription.toJSON()).catch(() => {});
			await subscription.unsubscribe();
		}
	} catch {
	} finally {
		remember(false);
		setState("off");
	}
}

export type TestOutcome = "sent" | "gone" | "no-server-keys" | "failed" | "error";

/** Asks the server to send this device a test notification, so the visitor can see it works. */
export async function sendTestPush(): Promise<TestOutcome> {
	try {
		const registration = await readyRegistration();
		const subscription = await registration.pushManager.getSubscription();

		if (!subscription) return "gone";

		const response = await post("/api/push/test", { endpoint: subscription.endpoint });
		const data = (await response.json().catch(() => ({}))) as { result?: string; error?: string };

		if (data.error === "no-keys") return "no-server-keys";

		if (data.result === "gone") {
			await subscription.unsubscribe().catch(() => {});
			setState("off");

			return "gone";
		}

		return data.result === "sent" ? "sent" : "failed";
	} catch {
		return "error";
	}
}

// ---- hooks ------------------------------------------------------------------------------------

export function usePush() {
	const state = useSyncExternalStore(
		stateStore.subscribe,
		stateStore.get,
		() => "checking" as PushState,
	);
	const error = useSyncExternalStore(errorStore.subscribe, errorStore.get, () => "");

	useEffect(start, []);

	return { state, error };
}

// ---- the guide (what to do when notifications are blocked) -----------------------------------

export type GuideKind = "denied" | "ios-install" | "not-arriving";

const guideStore = createStore<GuideKind | null>(null);

export const openGuide = (kind: GuideKind) => guideStore.set(kind);
export const closeGuide = () => guideStore.set(null);

export function useGuide() {
	return useSyncExternalStore(guideStore.subscribe, guideStore.get, () => null);
}

// ---- in-app messages: a push that arrives while the site is open, and "just enabled" ---------

export type InAppMessage = {
	id: number;
	kind: "push" | "enabled" | "tested";
	title: string;
	body: string;
	url?: string;
};

let nextId = 1;
const messagesStore = createStore<InAppMessage[]>([]);

export function pushMessage(message: Omit<InAppMessage, "id">) {
	const others = messagesStore.get().filter((m) => m.kind !== message.kind);

	messagesStore.set([...others, { ...message, id: nextId++ }]);
}

export function dismissMessage(id: number) {
	messagesStore.set(messagesStore.get().filter((m) => m.id !== id));
}

function announceEnabled() {
	pushMessage({
		kind: "enabled",
		title: "Οι ειδοποιήσεις είναι ενεργές ✓",
		body: "Θες να δεις ότι φτάνουν σε αυτή τη συσκευή;",
	});
}

export function useMessages() {
	return useSyncExternalStore(
		messagesStore.subscribe,
		messagesStore.get,
		() => [] as InAppMessage[],
	);
}
