"use client";

import Link from "next/link";
import { type ComponentProps, useEffect, useState } from "react";

const KEY = "greeceweather:admin-posts-query";
const BASE = "/admin/posts";

/** Called by the posts list: remembers which filters are applied. */
export function RememberPostsQuery() {
	useEffect(() => {
		try {
			sessionStorage.setItem(KEY, window.location.search);
		} catch {}
	}, []);

	return null;
}

/** A link to the posts list that comes back with the filters the list last had. */
export function PostsListLink(props: Omit<ComponentProps<typeof Link>, "href">) {
	const [href, setHref] = useState(BASE);

	useEffect(() => {
		try {
			setHref(`${BASE}${sessionStorage.getItem(KEY) ?? ""}`);
		} catch {}
	}, []);

	return <Link {...props} href={href} />;
}
