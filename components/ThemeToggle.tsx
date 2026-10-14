"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
	const observer = new MutationObserver(onChange);

	observer.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["data-theme"],
	});

	return () => observer.disconnect();
}

const getSnapshot = () => document.documentElement.dataset.theme === "dark";
const getServerSnapshot = () => false;

export function ThemeToggle() {
	const isDark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

	function toggle() {
		const next = isDark ? "light" : "dark";

		document.documentElement.dataset.theme = next;

		try {
			localStorage.setItem("theme", next);
		} catch {}
	}

	return (
		<button
			type="button"
			role="switch"
			aria-checked={isDark}
			aria-label="Σκοτεινή εμφάνιση"
			className="theme-toggle"
			onClick={toggle}
		>
			<span className="theme-toggle-knob" aria-hidden="true">
				<svg className="icon-moon" viewBox="0 0 24 24" width="14" height="14">
					<title>Φεγγάρι</title>
					<path
						d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z"
						fill="currentColor"
					/>
				</svg>
				<svg className="icon-sun" viewBox="0 0 24 24" width="14" height="14">
					<title>Ήλιος</title>
					<circle cx="12" cy="12" r="4.2" fill="currentColor" />
					<path
						d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
					/>
				</svg>
			</span>
		</button>
	);
}
