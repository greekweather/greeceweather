"use client";

import { useEffect, useState } from "react";
import { disablePush, enablePush, openGuide, usePush } from "@/lib/push-client";

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
		// blocked, or not installed yet: explain step by step what to do
		if (state === "ios-install" || state === "denied") {
			openGuide(state);
			return;
		}

		if (on) void disablePush();
		else void enablePush();
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

				<button type="button" className="button" onClick={toggle} disabled={state === "busy"}>
					{hint ? "Πώς να τις ενεργοποιήσω" : "Ενεργοποίηση ειδοποιήσεων"}
				</button>
			</div>
		);
	}

	return (
		<div className="install-app">
			<button
				type="button"
				className="install-app-button"
				onClick={toggle}
				disabled={state === "busy"}
			>
				{hint ? "Ειδοποιήσεις: πώς να τις ενεργοποιήσεις" : "Ειδοποιήσεις για χάρτες και έκτακτα"}
			</button>

			{error && <p className="install-app-help">{error}</p>}
		</div>
	);
}
