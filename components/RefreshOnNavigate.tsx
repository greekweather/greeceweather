"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export function RefreshOnNavigate() {
	const pathname = usePathname();
	const router = useRouter();
	const previous = useRef(pathname);

	useEffect(() => {
		if (pathname !== previous.current && !pathname.startsWith("/admin")) {
			router.refresh();
		}
		previous.current = pathname;
	}, [pathname, router]);

	useEffect(() => {
		function onPageShow(event: PageTransitionEvent) {
			if (event.persisted && !window.location.pathname.startsWith("/admin")) {
				window.location.reload();
			}
		}

		window.addEventListener("pageshow", onPageShow);
		return () => window.removeEventListener("pageshow", onPageShow);
	}, []);

	return null;
}
