"use client";

import { useEffect } from "react";

// Registers the service worker (production only, so it never gets in the way of `next dev`).
export function PwaRegister() {
	useEffect(() => {
		if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;

		navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
	}, []);

	return null;
}
