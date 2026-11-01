"use client";

import { useEffect, useState } from "react";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

type State = "checking" | "unsupported" | "ios-install" | "off" | "on" | "denied" | "busy";

function keyToBytes(base64url: string) {
	const padded = base64url
		.replace(/-/g, "+")
		.replace(/_/g, "/")
		.padEnd(Math.ceil(base64url.length / 4) * 4, "=");

	return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

async function send(path: string, subscription: PushSubscription) {
	return fetch(path, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(subscription.toJSON()),
	});
}

// Footer button: notifications on the phone for a new map and for an emergency bulletin.
// iPhone only allows them for the site added to the home screen, so Safari gets a hint.
export function PushToggle() {
	const [state, setState] = useState<State>("checking");

	useEffect(() => {
		if (!PUBLIC_KEY) {
			setState("unsupported");
			return;
		}

		const supported =
			"serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

		if (!supported) {
			const ios =
				/iPad|iPhone|iPod/.test(navigator.userAgent) ||
				(navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

			setState(ios ? "ios-install" : "unsupported");
			return;
		}

		if (Notification.permission === "denied") {
			setState("denied");
			return;
		}

		navigator.serviceWorker.ready
			.then((registration) => registration.pushManager.getSubscription())
			.then((subscription) => {
				if (subscription) {
					setState("on");
					// keeps the server's copy up to date (it is deleted if the push service said it was gone)
					send("/api/push/subscribe", subscription).catch(() => {});
				} else {
					setState("off");
				}
			})
			.catch(() => setState("unsupported"));
	}, []);

	async function enable() {
		if (!PUBLIC_KEY) return;

		setState("busy");

		try {
			const permission = await Notification.requestPermission();

			if (permission !== "granted") {
				setState(permission === "denied" ? "denied" : "off");
				return;
			}

			const registration = await navigator.serviceWorker.ready;
			const subscription =
				(await registration.pushManager.getSubscription()) ??
				(await registration.pushManager.subscribe({
					userVisibleOnly: true,
					applicationServerKey: keyToBytes(PUBLIC_KEY),
				}));

			const response = await send("/api/push/subscribe", subscription);

			if (!response.ok) throw new Error("subscribe");

			setState("on");
		} catch {
			setState("off");
		}
	}

	async function disable() {
		setState("busy");

		try {
			const registration = await navigator.serviceWorker.ready;
			const subscription = await registration.pushManager.getSubscription();

			if (subscription) {
				await send("/api/push/unsubscribe", subscription).catch(() => {});
				await subscription.unsubscribe();
			}
		} finally {
			setState("off");
		}
	}

	if (state === "checking" || state === "unsupported") return null;

	if (state === "ios-install") {
		return (
			<p className="install-app-help">
				Για ειδοποιήσεις στο iPhone πρόσθεσε πρώτα την εφαρμογή στην αρχική οθόνη.
			</p>
		);
	}

	if (state === "denied") {
		return (
			<p className="install-app-help">
				Οι ειδοποιήσεις είναι μπλοκαρισμένες. Επίτρεψέ τες από τις ρυθμίσεις του browser για αυτό
				το site.
			</p>
		);
	}

	return (
		<div className="install-app">
			<button
				type="button"
				className="install-app-button"
				onClick={state === "on" ? disable : enable}
				disabled={state === "busy"}
			>
				{state === "on" ? "Απενεργοποίηση ειδοποιήσεων" : "Ειδοποιήσεις για χάρτες και έκτακτα"}
			</button>

			{state === "on" && (
				<p className="install-app-help">
					Θα ειδοποιηθείς για κάθε νέο χάρτη και για κάθε έκτακτο δελτίο.
				</p>
			)}
		</div>
	);
}
