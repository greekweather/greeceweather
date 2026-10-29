"use client";

import { useEffect, useState } from "react";

// One shared check per page load, however many components ask. Visitors without a Supabase
// session cookie never trigger a request. Only a convenience: /admin enforces access itself.
let pending: Promise<boolean> | null = null;

function check(): Promise<boolean> {
	if (!/(?:^|;\s*)sb-[^=]*-auth-token/.test(document.cookie)) return Promise.resolve(false);

	pending ??= fetch("/api/admin-status", { cache: "no-store" })
		.then((response) => (response.ok ? response.json() : { admin: false }))
		.then((body: { admin?: boolean }) => body.admin === true)
		.catch(() => false);

	return pending;
}

export function useIsAdmin() {
	const [admin, setAdmin] = useState(false);

	useEffect(() => {
		let active = true;

		check().then((value) => {
			if (active) setAdmin(value);
		});

		return () => {
			active = false;
		};
	}, []);

	return admin;
}
