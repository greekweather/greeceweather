"use client";

import { PAGE_SIZE_COOKIE } from "@/lib/page-size-shared";

export function PageSizeSelect({
	size,
	options,
	firstPageHref,
}: {
	size: number;
	options: number[];
	firstPageHref: string;
}) {
	return (
		<label className="admin-pager-size">
			<span>Ανά σελίδα</span>

			<select
				value={size}
				onChange={(event) => {
					// biome-ignore lint/suspicious/noDocumentCookie: tiny preference cookie, the server reads it
					document.cookie = `${PAGE_SIZE_COOKIE}=${event.target.value}; path=/; max-age=31536000; samesite=lax`;
					// A full load: the server reads the cookie, and no cached copy of the list
					// (client router cache) can keep showing the old number of rows.
					window.location.assign(firstPageHref);
				}}
			>
				{options.map((option) => (
					<option key={option} value={option}>
						{option}
					</option>
				))}
			</select>
		</label>
	);
}
