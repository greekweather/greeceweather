"use client";

import { useState } from "react";

/** Saves the graphic that sits inside `[data-outlook-graphic]` as a PNG (2x), in the browser. */
export function DownloadPng({ fileName }: { fileName: string }) {
	const [busy, setBusy] = useState(false);
	const [failed, setFailed] = useState(false);

	async function download() {
		setBusy(true);
		setFailed(false);

		try {
			const svg = document.querySelector<SVGSVGElement>("[data-outlook-graphic] svg");
			if (!svg) throw new Error("no graphic");

			const viewBox = svg.viewBox.baseVal;
			const width = viewBox.width;
			const height = viewBox.height;

			const clone = svg.cloneNode(true) as SVGSVGElement;
			clone.setAttribute("width", String(width));
			clone.setAttribute("height", String(height));
			clone.removeAttribute("style");

			const source = new XMLSerializer().serializeToString(clone);
			const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
			const url = URL.createObjectURL(blob);

			const image = new Image();
			await new Promise<void>((resolve, reject) => {
				image.onload = () => resolve();
				image.onerror = () => reject(new Error("image"));
				image.src = url;
			});

			const scale = 2;
			const canvas = document.createElement("canvas");
			canvas.width = width * scale;
			canvas.height = height * scale;
			const ctx = canvas.getContext("2d");
			if (!ctx) throw new Error("canvas");
			ctx.fillStyle = "#ffffff";
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
			URL.revokeObjectURL(url);

			const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
			if (!png) throw new Error("png");

			const link = document.createElement("a");
			link.href = URL.createObjectURL(png);
			link.download = `${fileName}.png`;
			link.click();
			setTimeout(() => URL.revokeObjectURL(link.href), 1000);
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
