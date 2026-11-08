"use client";

import Link from "next/link";
import { useIsAdmin } from "@/components/useIsAdmin";

// "Edit in the admin panel" button at the end of an article or a map (pass postId, or an href). The page itself stays static and
// cached for everyone; the button only appears for signed-in admins (the check runs in the browser).
export function AdminEditLink({ postId, href }: { postId?: string; href?: string }) {
	if (!useIsAdmin()) return null;

	return (
		<p className="admin-edit-link">
			<Link className="button secondary" href={href ?? `/admin/posts/${postId}/edit`}>
				Επεξεργασία από το πάνελ
			</Link>
		</p>
	);
}
