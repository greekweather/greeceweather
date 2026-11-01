"use client";

import { type RefObject, useState } from "react";

type Format = "map" | "square" | "story";

const LOGO_URL = "/icons/icon-512.png";
const NAVY = "#0e2233";
const BLUE = "#1a5a96";

/** Loads an image (an SVG or PNG address) and waits until it can be drawn. */
async function loadImage(src: string): Promise<HTMLImageElement> {
	const image = new Image();
	image.decoding = "async";

	await new Promise<void>((resolve, reject) => {
		image.onload = () => resolve();
		image.onerror = () => reject(new Error("image"));
		image.src = src;
	});

	return image;
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
	return new Promise((resolve, reject) =>
		canvas.toBlob((png) => (png ? resolve(png) : reject(new Error("png"))), "image/png"),
	);
}

// Cuts a line of text into at most `maxLines` lines that fit `width`.
function wrapText(ctx: CanvasRenderingContext2D, text: string, width: number, maxLines: number) {
	const lines: string[] = [];
	let line = "";

	for (const word of text.split(/\s+/)) {
		const next = line ? `${line} ${word}` : word;

		if (line && ctx.measureText(next).width > width) {
			lines.push(line);
			line = word;
		} else {
			line = next;
		}
	}

	if (line) lines.push(line);

	if (lines.length > maxLines) {
		const kept = lines.slice(0, maxLines);
		kept[maxLines - 1] = `${kept[maxLines - 1].replace(/[\s.,;:]+$/, "")}…`;
		return kept;
	}

	return lines;
}

/**
 * Saves the graphic inside `containerRef` as a PNG, made in the browser:
 *   map    the map as it is, 2x
 *   square 1080x1080 post (Instagram, Facebook, Viber) with the logo and the title
 *   story  1080x1920 story with the logo and the title
 */
export function DownloadPng({
	fileName,
	containerRef,
}: {
	fileName: string;
	containerRef: RefObject<HTMLElement | null>;
}) {
	const [busy, setBusy] = useState<Format | null>(null);
	const [failed, setFailed] = useState(false);

	async function graphic() {
		const svg = containerRef.current?.querySelector("svg");

		if (!svg) throw new Error("no graphic");

		const { width, height } = svg.viewBox.baseVal;

		const clone = svg.cloneNode(true) as SVGSVGElement;
		clone.setAttribute("width", String(width));
		clone.setAttribute("height", String(height));
		clone.removeAttribute("style");

		const url = URL.createObjectURL(
			new Blob([new XMLSerializer().serializeToString(clone)], {
				type: "image/svg+xml;charset=utf-8",
			}),
		);

		try {
			return {
				image: await loadImage(url),
				width,
				height,
				title: svg.querySelector("title")?.textContent?.trim() ?? "",
			};
		} finally {
			URL.revokeObjectURL(url);
		}
	}

	async function makePng(format: Format): Promise<Blob> {
		const { image, width, height, title } = await graphic();

		if (format === "map") {
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

			return toBlob(canvas);
		}

		const story = format === "story";
		const W = 1080;
		const H = story ? 1920 : 1080;
		const margin = 40;
		const canvas = document.createElement("canvas");
		canvas.width = W;
		canvas.height = H;

		const ctx = canvas.getContext("2d");

		if (!ctx) throw new Error("canvas");

		const logo = await loadImage(LOGO_URL).catch(() => null);
		const family = getComputedStyle(document.body).fontFamily || "sans-serif";

		const background = ctx.createLinearGradient(0, 0, W, H);
		background.addColorStop(0, NAVY);
		background.addColorStop(1, BLUE);
		ctx.fillStyle = background;
		ctx.fillRect(0, 0, W, H);

		ctx.textBaseline = "alphabetic";
		ctx.fillStyle = "#ffffff";

		// Instagram and Facebook cover the top and bottom of a story with their own controls.
		const top = story ? 210 : 40;
		const logoSize = story ? 96 : 72;

		if (logo) ctx.drawImage(logo, margin, top, logoSize, logoSize);

		ctx.font = `700 ${story ? 40 : 32}px ${family}`;
		ctx.fillText(
			"GREECEWEATHER.GR",
			margin + logoSize + 20,
			top + logoSize / 2 + (story ? 14 : 11),
		);

		let y = top + logoSize + (story ? 50 : 18);

		if (story && title) {
			ctx.font = `700 54px ${family}`;

			for (const line of wrapText(ctx, title, W - margin * 2, 3)) {
				y += 66;
				ctx.fillText(line, margin, y);
			}

			y += 40;
		}

		// the map, as large as the space left allows, on a white sheet
		const footer = story ? 250 : 64;
		const room = H - y - footer;
		const fit = Math.min((W - margin * 2) / width, room / height);
		const drawW = width * fit;
		const drawH = height * fit;
		const x = (W - drawW) / 2;
		const mapTop = story ? y + Math.max(0, (room - drawH) / 2) : y + (room - drawH) / 2;

		ctx.fillStyle = "#ffffff";
		ctx.fillRect(x - 8, mapTop - 8, drawW + 16, drawH + 16);
		ctx.drawImage(image, x, mapTop, drawW, drawH);

		ctx.fillStyle = "rgba(255,255,255,0.85)";
		ctx.font = `700 ${story ? 30 : 24}px ${family}`;
		ctx.textAlign = "center";
		ctx.fillText("Ανεπίσημος χάρτης · greeceweather.gr", W / 2, story ? H - 170 : H - 22);

		return toBlob(canvas);
	}

	async function download(format: Format) {
		setBusy(format);
		setFailed(false);

		const name = format === "map" ? fileName : `${fileName}-${format}`;

		try {
			const png = await makePng(format);
			const file = new File([png], `${name}.png`, { type: "image/png" });

			// Phones: the share sheet offers "Save image" and works where a plain download link
			// is ignored (iOS Safari). Everywhere else: a normal download.
			const touch = window.matchMedia("(pointer: coarse)").matches;

			if (touch && navigator.canShare?.({ files: [file] })) {
				try {
					await navigator.share({ files: [file], title: name });
					return;
				} catch (error) {
					// the visitor closed the sheet: nothing more to do
					if (error instanceof DOMException && error.name === "AbortError") return;
				}
			}

			const href = URL.createObjectURL(png);
			const link = document.createElement("a");
			link.href = href;
			link.download = `${name}.png`;
			document.body.appendChild(link);
			link.click();
			link.remove();
			setTimeout(() => URL.revokeObjectURL(href), 10_000);
		} catch {
			setFailed(true);
		} finally {
			setBusy(null);
		}
	}

	return (
		<>
			<div className="outlook-download">
				<button
					type="button"
					className="button secondary"
					onClick={() => download("map")}
					disabled={busy !== null}
				>
					{busy === "map" ? "Δημιουργία…" : "Λήψη PNG"}
				</button>

				<button
					type="button"
					className="button secondary"
					onClick={() => download("square")}
					disabled={busy !== null}
				>
					{busy === "square" ? "Δημιουργία…" : "Τετράγωνο"}
				</button>

				<button
					type="button"
					className="button secondary"
					onClick={() => download("story")}
					disabled={busy !== null}
				>
					{busy === "story" ? "Δημιουργία…" : "Story"}
				</button>
			</div>

			{failed && (
				<span className="outlook-hint" role="alert">
					Δεν ήταν δυνατή η λήψη. Δοκίμασε screenshot.
				</span>
			)}
		</>
	);
}
