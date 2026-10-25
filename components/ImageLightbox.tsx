"use client";

import { useEffect, useState } from "react";

type Zoomed = { src: string; alt: string; caption: string };

// Click an article image to see it large; click again, press Esc, or tap × to close.
// One listener on the document, so it also works for images the Markdown renders.
export function ImageLightbox() {
	const [zoomed, setZoomed] = useState<Zoomed | null>(null);

	useEffect(() => {
		function onClick(event: MouseEvent) {
			const target = event.target;

			if (!(target instanceof HTMLImageElement)) return;
			if (!target.closest(".article-body, .article-hero")) return;

			const caption =
				target.closest("figure, .article-figure")?.querySelector("figcaption, .article-caption")
					?.textContent ?? "";

			setZoomed({
				src: target.dataset.full || target.currentSrc || target.src,
				alt: target.alt,
				caption,
			});
		}

		document.addEventListener("click", onClick);
		return () => document.removeEventListener("click", onClick);
	}, []);

	useEffect(() => {
		if (!zoomed) return;

		const previous = document.body.style.overflow;
		document.body.style.overflow = "hidden";

		function onKey(event: KeyboardEvent) {
			if (event.key === "Escape") setZoomed(null);
		}

		window.addEventListener("keydown", onKey);

		return () => {
			document.body.style.overflow = previous;
			window.removeEventListener("keydown", onKey);
		};
	}, [zoomed]);

	if (!zoomed) return null;

	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: Escape is handled on window
		<div
			className="lightbox"
			role="dialog"
			aria-modal="true"
			aria-label={zoomed.alt || "Μεγέθυνση εικόνας"}
			onClick={() => setZoomed(null)}
		>
			<button
				type="button"
				className="lightbox-close"
				aria-label="Κλείσιμο"
				onClick={() => setZoomed(null)}
			>
				×
			</button>

			{/* biome-ignore lint/performance/noImgElement: full-size original */}
			<img src={zoomed.src} alt={zoomed.alt} />

			{zoomed.caption && <p className="lightbox-caption">{zoomed.caption}</p>}
		</div>
	);
}
