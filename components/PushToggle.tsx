"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

type State = "checking" | "unsupported" | "ios-install" | "off" | "on" | "denied" | "busy";

// One shared state for every button on the page (header bell, maps page card, footer), so
// turning notifications on in one place updates all of them.
let current: State = "checking";
let lastError = "";
let started = false;
const listeners = new Set<() => void>();

function set(next: State, error = "") {
	current = next;
	lastError = error;

	for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
	listeners.add(listener);

	return () => {
		listeners.delete(listener);
	};
}

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

function start() {
	if (started) return;

	started = true;

	if (!PUBLIC_KEY) {
		set("unsupported");
		return;
	}

	const supported =
		"serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

	if (!supported) {
		const ios =
			/iPad|iPhone|iPod/.test(navigator.userAgent) ||
			(navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

		set(ios ? "ios-install" : "unsupported");
		return;
	}

	if (Notification.permission === "denied") {
		set("denied");
		return;
	}

	navigator.serviceWorker.ready
		.then((registration) => registration.pushManager.getSubscription())
		.then((subscription) => {
			if (subscription) {
				set("on");
				// keeps the server's copy up to date (it is deleted if the push service said it was gone)
				send("/api/push/subscribe", subscription).catch(() => {});
			} else {
				set("off");
			}
		})
		.catch(() => set("unsupported"));
}

async function enable() {
	if (!PUBLIC_KEY) return;

	set("busy");

	try {
		const permission = await Notification.requestPermission();

		if (permission !== "granted") {
			set(permission === "denied" ? "denied" : "off");
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

		if (!response.ok) {
			// the phone is subscribed but the site could not save it: undo, so nothing is half-done
			await subscription.unsubscribe().catch(() => {});
			throw new Error(`ο server απάντησε ${response.status}`);
		}

		set("on");
	} catch (error) {
		set(
			"off",
			`Δεν ήταν δυνατή η ενεργοποίηση (${error instanceof Error ? error.message : "άγνωστο σφάλμα"}).`,
		);
	}
}

async function disable() {
	set("busy");

	try {
		const registration = await navigator.serviceWorker.ready;
		const subscription = await registration.pushManager.getSubscription();

		if (subscription) {
			await send("/api/push/unsubscribe", subscription).catch(() => {});
			await subscription.unsubscribe();
		}
	} finally {
		set("off");
	}
}

function usePush() {
	const state = useSyncExternalStore(
		subscribe,
		() => current,
		() => "checking" as State,
	);

	useEffect(start, []);

	const error = useSyncExternalStore(
		subscribe,
		() => lastError,
		() => "",
	);

	return { state, error };
}

const HINT = {
	"ios-install": "Για ειδοποιήσεις στο iPhone πρόσθεσε πρώτα την εφαρμογή στην αρχική οθόνη.",
	denied:
		"Οι ειδοποιήσεις είναι μπλοκαρισμένες. Επίτρεψέ τες από τις ρυθμίσεις του browser για αυτό το site.",
} as const;

function Bell({ on }: { on: boolean }) {
	return (
		<svg
			viewBox="0 0 24 24"
			width="20"
			height="20"
			fill={on ? "currentColor" : "none"}
			aria-hidden="true"
		>
			<path
				d="M6 9a6 6 0 1 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9Z"
				stroke="currentColor"
				strokeWidth="1.8"
				strokeLinejoin="round"
			/>
			<path
				d="M10 19a2 2 0 0 0 4 0"
				stroke="currentColor"
				strokeWidth="1.8"
				strokeLinecap="round"
			/>
			{!on && (
				<path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
			)}
		</svg>
	);
}

/**
 * Notifications on the phone / computer for a new map and for an emergency bulletin.
 *   bell    icon button in the header (website and installed app)
 *   card    a box with an explanation, on the maps page
 *   footer  text button in the footer
 * iPhone only allows notifications for the site added to the home screen, so Safari gets a hint.
 */
export function PushToggle({ variant = "footer" }: { variant?: "bell" | "card" | "footer" }) {
	const { state, error } = usePush();
	const [note, setNote] = useState(false);

	// a failure is shown under the bell right away
	useEffect(() => {
		if (error) setNote(true);
	}, [error]);

	// the little explanation under the bell disappears by itself
	useEffect(() => {
		if (!note) return;

		const timer = window.setTimeout(() => setNote(false), 7000);

		return () => window.clearTimeout(timer);
	}, [note]);

	if (state === "checking" || state === "unsupported") return null;

	const on = state === "on";
	const hint = state === "ios-install" || state === "denied" ? HINT[state] : null;

	function toggle() {
		if (hint) {
			setNote((value) => !value);
			return;
		}

		if (on) disable();
		else enable();
	}

	if (variant === "bell") {
		const label = on ? "Απενεργοποίηση ειδοποιήσεων" : "Ενεργοποίηση ειδοποιήσεων";

		return (
			<span className="push-bell-wrap">
				<button
					type="button"
					className={`push-bell ${on ? "on" : ""}`}
					onClick={toggle}
					disabled={state === "busy"}
					aria-label={label}
					aria-pressed={on}
					title={label}
				>
					<Bell on={on} />
				</button>

				{note && (hint || error) && (
					<span className="push-bell-note" role="status">
						{hint || error}
					</span>
				)}
			</span>
		);
	}

	// Once notifications are on, the box and the footer button have nothing left to offer: they
	// disappear. The bell in the header stays, filled in, as the way to turn them off again.
	if (on) return null;

	if (variant === "card") {
		return (
			<div className="push-card">
				<div>
					<strong>Ειδοποιήσεις</strong>
					<p>
						Πάρε ειδοποίηση στο κινητό ή στον υπολογιστή όταν βγαίνει νέος χάρτης ή έκτακτο δελτίο.
					</p>
					{(hint || error) && <p className="push-card-hint">{hint || error}</p>}
				</div>

				{!hint && (
					<button type="button" className="button" onClick={toggle} disabled={state === "busy"}>
						Ενεργοποίηση ειδοποιήσεων
					</button>
				)}
			</div>
		);
	}

	if (hint) return <p className="install-app-help">{hint}</p>;

	return (
		<div className="install-app">
			<button
				type="button"
				className="install-app-button"
				onClick={toggle}
				disabled={state === "busy"}
			>
				Ειδοποιήσεις για χάρτες και έκτακτα
			</button>

			{error && <p className="install-app-help">{error}</p>}
		</div>
	);
}
