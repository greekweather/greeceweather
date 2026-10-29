"use client";

import { useEffect, useState } from "react";

type InstallEvent = Event & { prompt: () => Promise<void> };

// "Install the app" helper for the footer.
// Chrome / Edge / Samsung / Android Firefox: real install prompt.
// iPhone / iPad Safari: has no prompt, so it shows the two taps to do by hand.
// Hidden when the site is already running as an installed app.
export function InstallApp() {
	const [prompt, setPrompt] = useState<InstallEvent | null>(null);
	const [ios, setIos] = useState(false);
	const [installed, setInstalled] = useState(true);
	const [help, setHelp] = useState(false);

	useEffect(() => {
		const standalone =
			window.matchMedia("(display-mode: standalone)").matches ||
			(navigator as Navigator & { standalone?: boolean }).standalone === true;

		setInstalled(standalone);
		setIos(
			/iPad|iPhone|iPod/.test(navigator.userAgent) ||
				(navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
		);

		const onPrompt = (event: Event) => {
			event.preventDefault();
			setPrompt(event as InstallEvent);
		};
		const onInstalled = () => setInstalled(true);

		window.addEventListener("beforeinstallprompt", onPrompt);
		window.addEventListener("appinstalled", onInstalled);

		return () => {
			window.removeEventListener("beforeinstallprompt", onPrompt);
			window.removeEventListener("appinstalled", onInstalled);
		};
	}, []);

	if (installed || (!prompt && !ios)) return null;

	async function install() {
		if (prompt) {
			await prompt.prompt();
			setPrompt(null);
		} else {
			setHelp((value) => !value);
		}
	}

	return (
		<div className="install-app">
			<button type="button" className="install-app-button" onClick={install}>
				Εγκατάσταση εφαρμογής
			</button>

			{help && (
				<p className="install-app-help">
					Πάτα το κουμπί «Κοινοποίηση» του Safari και μετά «Προσθήκη στην αρχική οθόνη».
				</p>
			)}
		</div>
	);
}
