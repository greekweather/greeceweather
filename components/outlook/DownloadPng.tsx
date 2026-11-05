"use client";

import { type RefObject, useEffect, useRef, useState } from "react";

type Format = "map" | "square" | "story";

const LOGO_URL = "/icons/icon-512.png";

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

function roundRect(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	w: number,
	h: number,
	r: number,
) {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.arcTo(x + w, y, x + w, y + h, r);
	ctx.arcTo(x + w, y + h, x, y + h, r);
	ctx.arcTo(x, y + h, x, y, r);
	ctx.arcTo(x, y, x + w, y, r);
	ctx.closePath();
}

// Layered backdrop: deep gradient, soft colour glows, isobar-like contour lines, a dotted
// grid fading out and a few pressure-centre rings. Fixed numbers, so every export looks alike.
function paintBackdrop(ctx: CanvasRenderingContext2D, W: number, H: number) {
	const base = ctx.createLinearGradient(0, 0, W * 0.6, H);

	base.addColorStop(0, "#0b1b3a");
	base.addColorStop(0.45, "#12407a");
	base.addColorStop(0.8, "#0e6a8f");
	base.addColorStop(1, "#14385e");
	ctx.fillStyle = base;
	ctx.fillRect(0, 0, W, H);

	const glow = (cx: number, cy: number, r: number, color: string) => {
		const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);

		g.addColorStop(0, color);
		g.addColorStop(1, "rgba(0,0,0,0)");
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, W, H);
	};

	glow(W * 0.9, H * 0.08, W * 0.7, "rgba(244,63,94,0.30)");
	glow(W * 0.05, H * 0.55, W * 0.75, "rgba(56,189,248,0.28)");
	glow(W * 0.85, H * 0.95, W * 0.8, "rgba(251,191,36,0.26)");
	glow(W * 0.3, H * 0.02, W * 0.5, "rgba(167,139,250,0.28)");

	// contour lines
	ctx.lineWidth = 2;

	for (let i = 0; i < 16; i += 1) {
		const baseY = (H / 15) * i;
		const amp = 34 + (i % 4) * 14;
		const phase = i * 0.7;

		ctx.beginPath();

		for (let px = -20; px <= W + 20; px += 20) {
			const py = baseY + Math.sin(px / 170 + phase) * amp + Math.sin(px / 61 + phase * 2) * 8;

			if (px === -20) ctx.moveTo(px, py);
			else ctx.lineTo(px, py);
		}

		ctx.strokeStyle = `rgba(255,255,255,${i % 3 === 0 ? 0.13 : 0.07})`;
		ctx.stroke();
	}

	// pressure-centre rings
	for (const [cx, cy, count] of [
		[W * 0.12, H * 0.2, 5],
		[W * 0.92, H * 0.72, 6],
	] as const) {
		for (let k = 1; k <= count; k += 1) {
			ctx.beginPath();
			ctx.arc(cx, cy, k * 42, 0, Math.PI * 2);
			ctx.strokeStyle = `rgba(255,255,255,${0.12 - k * 0.012})`;
			ctx.stroke();
		}
	}

	// dotted grid, strongest at the corners
	for (let gx = 20; gx < W; gx += 36) {
		for (let gy = 20; gy < H; gy += 36) {
			const d = Math.min(
				Math.hypot(gx, gy),
				Math.hypot(W - gx, gy),
				Math.hypot(gx, H - gy),
				Math.hypot(W - gx, H - gy),
			);
			const a = Math.max(0, 0.22 - d / 2400);

			if (a > 0.01) {
				ctx.fillStyle = `rgba(255,255,255,${a})`;
				ctx.fillRect(gx, gy, 3, 3);
			}
		}
	}

	// thin inner frame
	ctx.strokeStyle = "rgba(255,255,255,0.18)";
	ctx.lineWidth = 2;
	roundRect(ctx, 18, 18, W - 36, H - 36, 30);
	ctx.stroke();
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
	const [open, setOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;

		const close = (event: Event) => {
			if (event.target instanceof Node && menuRef.current?.contains(event.target)) return;

			setOpen(false);
		};
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") setOpen(false);
		};

		document.addEventListener("pointerdown", close);
		document.addEventListener("keydown", onKey);

		return () => {
			document.removeEventListener("pointerdown", close);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);

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
		const margin = story ? 56 : 48;
		const canvas = document.createElement("canvas");
		canvas.width = W;
		canvas.height = H;

		const ctx = canvas.getContext("2d");

		if (!ctx) throw new Error("canvas");

		const logo = await loadImage(LOGO_URL).catch(() => null);
		const family = getComputedStyle(document.body).fontFamily || "sans-serif";

		paintBackdrop(ctx, W, H);

		ctx.textBaseline = "alphabetic";
		ctx.textAlign = "left";

		// Instagram and Facebook cover the top and bottom of a story with their own controls.
		const top = story ? 190 : 46;
		const logoSize = story ? 84 : 64;

		// brand pill: logo + name
		const brandText = "greeceweather.gr";
		ctx.font = `700 ${story ? 36 : 28}px ${family}`;
		const pillW = logoSize + 24 + ctx.measureText(brandText).width + 34;
		const pillH = logoSize + 16;

		roundRect(ctx, margin, top - 8, pillW, pillH, pillH / 2);
		ctx.fillStyle = "rgba(255,255,255,0.12)";
		ctx.fill();
		ctx.strokeStyle = "rgba(255,255,255,0.28)";
		ctx.lineWidth = 2;
		ctx.stroke();

		if (logo) {
			ctx.save();
			ctx.beginPath();
			ctx.arc(margin + 8 + logoSize / 2, top + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
			ctx.clip();
			ctx.drawImage(logo, margin + 8, top, logoSize, logoSize);
			ctx.restore();
		}

		ctx.fillStyle = "#ffffff";
		ctx.fillText(brandText, margin + 8 + logoSize + 18, top + logoSize / 2 + (story ? 13 : 10));

		let y = top + pillH + (story ? 54 : 30);

		// accent bar + title
		if (title) {
			const size = story ? 62 : 44;
			const lineH = Math.round(size * 1.18);

			ctx.font = `800 ${size}px ${family}`;

			const lines = wrapText(ctx, title, W - margin * 2 - 28, story ? 4 : 2);
			const block = lines.length * lineH;
			const bar = ctx.createLinearGradient(0, y, 0, y + block);

			bar.addColorStop(0, "#fbbf24");
			bar.addColorStop(1, "#f43f5e");
			ctx.fillStyle = bar;
			roundRect(ctx, margin, y, 8, block, 4);
			ctx.fill();

			ctx.fillStyle = "#ffffff";
			ctx.shadowColor = "rgba(5,15,30,0.45)";
			ctx.shadowBlur = 12;

			lines.forEach((line, index) => {
				ctx.fillText(line, margin + 28, y + size * 0.9 + index * lineH);
			});

			ctx.shadowBlur = 0;
			y += block + (story ? 48 : 26);
		}

		// the map, as large as the space left allows, on a rounded card
		const footer = story ? 240 : 78;
		const room = H - y - footer;
		const fit = Math.min((W - margin * 2) / width, room / height);
		const drawW = width * fit;
		const drawH = height * fit;
		const x = (W - drawW) / 2;
		const mapTop = y + Math.max(0, (room - drawH) / 2);

		ctx.save();
		ctx.shadowColor = "rgba(3,10,25,0.55)";
		ctx.shadowBlur = 44;
		ctx.shadowOffsetY = 16;
		roundRect(ctx, x, mapTop, drawW, drawH, 26);
		ctx.fillStyle = "#ffffff";
		ctx.fill();
		ctx.restore();

		ctx.save();
		roundRect(ctx, x, mapTop, drawW, drawH, 26);
		ctx.clip();
		ctx.drawImage(image, x, mapTop, drawW, drawH);
		ctx.restore();

		roundRect(ctx, x, mapTop, drawW, drawH, 26);
		ctx.strokeStyle = "rgba(255,255,255,0.65)";
		ctx.lineWidth = 3;
		ctx.stroke();

		// footer tag
		const tag = "Ανεπίσημη πρόγνωση · greeceweather.gr";
		const tagY = story ? H - 150 : H - 30;

		ctx.textAlign = "center";
		ctx.font = `600 ${story ? 30 : 23}px ${family}`;
		ctx.fillStyle = "rgba(255,255,255,0.88)";
		ctx.fillText(tag, W / 2, tagY);

		const tagW = ctx.measureText(tag).width;
		const rule = ctx.createLinearGradient(W / 2 - tagW / 2, 0, W / 2 + tagW / 2, 0);

		rule.addColorStop(0, "#38bdf8");
		rule.addColorStop(0.5, "#fbbf24");
		rule.addColorStop(1, "#f43f5e");
		ctx.fillStyle = rule;
		ctx.fillRect(W / 2 - tagW / 2, tagY + 14, tagW, 4);

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

	const items: { format: Format; label: string; hint: string }[] = [
		{ format: "map", label: "PNG", hint: "ο χάρτης όπως φαίνεται" },
		{ format: "square", label: "Τετράγωνο", hint: "1080 × 1080 · post" },
		{ format: "story", label: "Story", hint: "1080 × 1920 · κάθετο" },
	];

	return (
		<>
			<div className="outlook-download" ref={menuRef}>
				<button
					type="button"
					className="button secondary outlook-download-toggle"
					aria-haspopup="menu"
					aria-expanded={open}
					onClick={() => setOpen((value) => !value)}
					disabled={busy !== null}
				>
					{busy ? "Δημιουργία…" : "Λήψη ως"}
					<span aria-hidden="true" className="outlook-download-caret">
						▾
					</span>
				</button>

				{open && (
					<div className="outlook-download-menu" role="menu">
						{items.map((item) => (
							<button
								key={item.format}
								type="button"
								role="menuitem"
								className="outlook-download-item"
								onClick={() => {
									setOpen(false);
									void download(item.format);
								}}
							>
								<strong>{item.label}</strong>
								<small>{item.hint}</small>
							</button>
						))}
					</div>
				)}
			</div>

			{failed && (
				<span className="outlook-hint" role="alert">
					Δεν ήταν δυνατή η λήψη. Δοκίμασε screenshot.
				</span>
			)}
		</>
	);
}
