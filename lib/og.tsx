import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// Share cards (what Viber, Facebook, Messenger and X show for a link) are 1200x630 PNGs.
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

export const OG_NAVY = "#0e2233";
export const OG_BLUE = "#1a5a96";

type OgFont = { name: string; data: Buffer; weight: 700; style: "normal" };

let fonts: Promise<OgFont[]> | undefined;

// The card's text font. The default font of the image renderer has no Greek letters, so a
// small subset of DejaVu Sans Bold (Greek + Latin, ~55 KB) ships with the site.
export function loadOgFonts(): Promise<OgFont[]> {
	fonts ??= readFile(path.join(process.cwd(), "assets/fonts/DejaVuSans-Bold.subset.ttf"))
		.then((data) => [{ name: "OG", data, weight: 700 as const, style: "normal" as const }])
		.catch(() => []);

	return fonts;
}

// Fetches a photo and returns it as a 1200x630 JPEG data URI. The renderer cannot read WebP
// (which is what uploaded photos are), so every photo goes through sharp. Any failure gives
// null and the card falls back to the plain background.
export async function photoDataUri(url: string | null | undefined): Promise<string | null> {
	if (!url || !/^https?:\/\//i.test(url)) return null;

	try {
		const response = await fetch(url, { signal: AbortSignal.timeout(6000) });

		if (!response.ok) return null;

		const jpeg = await sharp(Buffer.from(await response.arrayBuffer()))
			.resize(OG_SIZE.width, OG_SIZE.height, { fit: "cover" })
			.jpeg({ quality: 78 })
			.toBuffer();

		return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
	} catch {
		return null;
	}
}

// Title size that keeps up to ~3 lines inside the card.
export function titleSize(title: string, large = 64): number {
	if (title.length <= 45) return large;
	if (title.length <= 85) return large - 10;

	return large - 20;
}

export function clip(text: string, max: number): string {
	return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}
