"use client";

import { type RefObject, useState } from "react";

/** Saves the graphic inside `containerRef` as a PNG (2x), made in the browser. */
export function DownloadPng({
	fileName,
	containerRef,
}: {
	fileName: string;
	containerRef: RefObject<HTMLElement | null>;
}) {
	const [busy, setBusy] = useState(false);
	const [failed, setFailed] = useState(false);

	async function makePng(): Promise<Blob> {
		const svg = containerRef.current?.querySelector("svg");

		if (!svg) throw new Error("no graphic");

		const { width, height } = svg.viewBox.baseVal;

		const clone = svg.cloneNode(true) as SVGSVGElement;
		clone.setAttribute("width", String(width));
		clone.setAttribute("height", String(height));
		clone.removeAttribute("style");

		const source = new XMLSerializer().serializeToString(clone);
		const url = URL.createObjectURL(new Blob([source], { type: "image/svg+xml;charset=utf-8" }));

		try {
			const image = new Image();
			image.decoding = "async";

			await new Promise<void>((resolve, reject) => {
				image.onload = () => resolve();
				image.onerror = () => reject(new Error("image"));
				image.src = url;
			});

			// Phones run out of canvas memory above ~16 MP; 2x of this map is well below that.
			const scale = 2;
			const canvas = document.createElement("canvas");
			canvas.width = Math.round(width * scale);
			canvas.height = Math.round(height * scale);

			const ctx = canvas.getContext("2d");

			if (!ctx) throw new Error("canvas");

			ctx.fillStyle = "#ffffff";
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

			const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));

			if (!png) throw new Error("png");

			return png;
		} finally {
			URL.revokeObjectURL(url);
		}
	}

	async function download() {
		setBusy(true);
		setFailed(false);

		try {
			const png = await makePng();
			const file = new File([png], `${fileName}.png`, { type: "image/png" });

			// Phones: the share sheet offers "Save image" and works where a plain download link
			// is ignored (iOS Safari). Everywhere else: a normal download.
			const touch = window.matchMedia("(pointer: coarse)").matches;

			if (touch && navigator.canShare?.({ files: [file] })) {
				try {
					await navigator.share({ files: [file], title: fileName });
					return;
				} catch (error) {
					// the visitor closed the sheet: nothing more to do
					if (error instanceof DOMException && error.name === "AbortError") return;
				}
			}

			const href = URL.createObjectURL(png);
			const link = document.createElement("a");
			link.href = href;
			link.download = `${fileName}.png`;
			document.body.appendChild(link);
			link.click();
			link.remove();
			setTimeout(() => URL.revokeObjectURL(href), 10_000);
		} catch {
			setFailed(true);
		} finally {
			setBusy(false);
		}
	}

	return (
		<>
			<button type="button" className="button secondary" onClick={download} disabled={busy}>
				{busy ? "Δημιουργία εικόνας…" : "Λήψη ως εικόνα (PNG)"}
			</button>

			{failed && (
				<span className="outlook-hint" role="alert">
					Δεν ήταν δυνατή η λήψη. Δοκίμασε screenshot.
				</span>
			)}
		</>
	);
}
