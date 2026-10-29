"use client";

import Link from "next/link";
import { useIsAdmin } from "@/components/useIsAdmin";

// "Διαχείριση" button in the header (desktop), shown only to signed-in admins.
// On phones the same link lives in the bottom tab bar instead.
export function AdminLink() {
	if (!useIsAdmin()) return null;

	return (
		<Link href="/admin" className="admin-link">
			Διαχείριση
		</Link>
	);
}
