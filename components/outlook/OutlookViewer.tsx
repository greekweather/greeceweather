"use client";

import { useEffect, useRef, useState } from "react";

// Greece and the central Mediterranean sit about 62% across the map (-30° to 50° E).
const START_X = 0.62;

/**
 * Wraps the server-rendered graphic. On a phone the map keeps a readable width and the
 * visitor scrolls sideways, starting centred on Greece. "Full screen" opens a larger
 * copy that can be panned and pinch-zoomed with the browser's own gestures.
 */
export function OutlookViewer({ children }: { children: React.ReactNode }) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const fullRef = useRef<HTMLDivElement>(null);
	const [open, setOpen] = useState(false);

	useEffect(() => {
		const el = scrollRef.current;
		if (!el || el.scrollWidth <= el.clientWidth) return;
		el.scrollLeft = el.scrollWidth * START_X - el.clientWidth / 2;
	}, []);

	useEffect(() => {
		if (!open) return;

		const previous = document.body.style.overflow;
		document.body.style.overflow = "hidden";

		const el = fullRef.current;
		if (el) {
			el.scrollLeft = el.scrollWidth * START_X - el.clientWidth / 2;
			el.scrollTop = 0;
		}

		function onKey(event: KeyboardEvent) {
			if (event.key === "Escape") setOpen(false);
		}

		window.addEventListener("keydown", onKey);

		return () => {
			document.body.style.overflow = previous;
			window.removeEventListener("keydown", onKey);
		};
	}, [open]);

	return (
		<>
			<div className="outlook-scroll" data-outlook-graphic ref={scrollRef}>
				<div className="outlook-graphic-wrap">{children}</div>
			</div>

			<div className="outlook-viewer-bar">
				<span className="outlook-hint">Σύρε πλαγίως για να δεις όλον τον χάρτη.</span>
				<button type="button" className="button secondary" onClick={() => setOpen(true)}>
					Πλήρης οθόνη
				</button>
			</div>

			{open && (
				<div
					className="outlook-full"
					role="dialog"
					aria-modal="true"
					aria-label="Χάρτης σε πλήρη οθόνη"
				>
					<button type="button" className="outlook-full-close" onClick={() => setOpen(false)}>
						Κλείσιμο ×
					</button>
					<div className="outlook-full-scroll" ref={fullRef}>
						<div className="outlook-full-inner">{children}</div>
					</div>
				</div>
			)}
		</>
	);
}
