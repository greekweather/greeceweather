"use client";

import { useEffect, useState } from "react";

// setTimeout cannot wait longer than this (about 24.8 days).
const MAX_DELAY = 2_147_483_647;

// Hides its content once the given time has passed. The home page is cached for up to a minute
// (and the first visitor after that still gets the old copy), so the server alone cannot make
// an expired banner vanish on time. The browser has the last word.
export function ExpiresAt({ at, children }: { at: string | null; children: React.ReactNode }) {
	const [expired, setExpired] = useState(false);

	useEffect(() => {
		if (!at) return;

		const end = new Date(at).getTime();

		if (Number.isNaN(end)) return;

		function check() {
			if (Date.now() >= end) setExpired(true);
		}

		check();

		const timer = window.setTimeout(check, Math.min(Math.max(end - Date.now(), 0), MAX_DELAY));

		// a phone that slept past the end time has no timer to fire, so look again on return
		document.addEventListener("visibilitychange", check);

		return () => {
			window.clearTimeout(timer);
			document.removeEventListener("visibilitychange", check);
		};
	}, [at]);

	return expired ? null : children;
}
