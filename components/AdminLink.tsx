"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Shows a "Διαχείριση" link in the header, but only to signed-in admins.
// Visitors without a Supabase session cookie never trigger a request, and everyone else is
// checked on the server, so the link is never rendered for the public and the pages stay static.
export function AdminLink() {
	const [admin, setAdmin] = useState(false);

	useEffect(() => {
		if (!/(?:^|;\s*)sb-[^=]*-auth-token/.test(document.cookie)) return;

		const controller = new AbortController();

		fetch("/api/admin-status", { cache: "no-store", signal: controller.signal })
			.then((response) => (response.ok ? response.json() : { admin: false }))
			.then((body: { admin?: boolean }) => setAdmin(body.admin === true))
			.catch(() => {});

		return () => controller.abort();
	}, []);

	if (!admin) return null;

	return (
		<Link href="/admin" className="admin-link">
			Διαχείριση
		</Link>
	);
}
