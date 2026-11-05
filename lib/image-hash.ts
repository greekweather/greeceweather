// Visual duplicate check, entirely in the browser: every picture is shrunk to a 9x8 grey
// grid and one bit is kept per neighbouring pair (a "difference hash"). Copies, resized or
// recompressed versions of the same picture end up with almost the same 64 bits.

export type ImageFingerprint = { hash: string; ratio: number };

const CACHE_KEY = "greeceweather:image-fingerprints:v1";
const MAX_DISTANCE = 6;
const MAX_SCANNED = 400;

function fingerprint(source: CanvasImageSource, width: number, height: number): ImageFingerprint {
	const canvas = document.createElement("canvas");
	canvas.width = 9;
	canvas.height = 8;

	const ctx = canvas.getContext("2d", { willReadFrequently: true });

	if (!ctx) throw new Error("canvas");

	ctx.fillStyle = "#fff";
	ctx.fillRect(0, 0, 9, 8);
	ctx.drawImage(source, 0, 0, 9, 8);

	const { data } = ctx.getImageData(0, 0, 9, 8);
	const gray = (x: number, y: number) => {
		const i = (y * 9 + x) * 4;

		return data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
	};

	let bits = "";

	for (let y = 0; y < 8; y += 1) {
		for (let x = 0; x < 8; x += 1) {
			bits += gray(x, y) > gray(x + 1, y) ? "1" : "0";
		}
	}

	let hash = "";

	for (let i = 0; i < 64; i += 4) {
		hash += Number.parseInt(bits.slice(i, i + 4), 2).toString(16);
	}

	return { hash, ratio: width / Math.max(1, height) };
}

export async function fingerprintFile(file: Blob): Promise<ImageFingerprint> {
	const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });

	try {
		return fingerprint(bitmap, bitmap.width, bitmap.height);
	} finally {
		bitmap.close();
	}
}

async function fingerprintUrl(url: string): Promise<ImageFingerprint> {
	const image = new Image();

	image.crossOrigin = "anonymous";
	image.decoding = "async";

	await new Promise<void>((resolve, reject) => {
		image.onload = () => resolve();
		image.onerror = () => reject(new Error("load"));
		image.src = url;
	});

	return fingerprint(image, image.naturalWidth, image.naturalHeight);
}

function distance(a: string, b: string): number {
	let count = 0;

	for (let i = 0; i < a.length; i += 1) {
		let x = Number.parseInt(a[i], 16) ^ Number.parseInt(b[i], 16);

		while (x) {
			count += x & 1;
			x >>= 1;
		}
	}

	return count;
}

export function findLookalike<T extends { fingerprint: ImageFingerprint }>(
	candidate: ImageFingerprint,
	known: T[],
): T | null {
	let best: T | null = null;
	let bestDistance = MAX_DISTANCE + 1;

	for (const item of known) {
		if (Math.abs(item.fingerprint.ratio - candidate.ratio) > 0.06) continue;

		const d = distance(candidate.hash, item.fingerprint.hash);

		if (d < bestDistance) {
			best = item;
			bestDistance = d;
		}
	}

	return best;
}

function readCache(): Record<string, ImageFingerprint> {
	try {
		return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}");
	} catch {
		return {};
	}
}

/**
 * Fingerprints of the library's images (newest first), cached in this browser. A picture that
 * cannot be read (blocked by the browser, deleted) is skipped; if nothing can be read the
 * result is simply empty and no duplicate warning ever shows.
 */
export async function fingerprintLibrary<T extends { url: string }>(
	images: T[],
	onProgress?: (done: number, total: number) => void,
): Promise<(T & { fingerprint: ImageFingerprint })[]> {
	const cache = readCache();
	const list = images.slice(0, MAX_SCANNED);
	const result: (T & { fingerprint: ImageFingerprint })[] = [];
	let done = 0;
	let next = 0;

	async function worker() {
		while (next < list.length) {
			const item = list[next];

			next += 1;

			try {
				const known = cache[item.url] ?? (await fingerprintUrl(item.url));

				cache[item.url] = known;
				result.push({ ...item, fingerprint: known });
			} catch {}

			done += 1;
			onProgress?.(done, list.length);
		}
	}

	await Promise.all([worker(), worker(), worker(), worker()]);

	try {
		const live = new Set(list.map((item) => item.url));
		const pruned = Object.fromEntries(Object.entries(cache).filter(([url]) => live.has(url)));

		localStorage.setItem(CACHE_KEY, JSON.stringify(pruned));
	} catch {}

	return result;
}

/** The library image that looks like `file`, or null (also null when the check cannot run). */
export async function findVisualDuplicate<T extends { url: string }>(
	file: Blob,
	library: T[],
	onProgress?: (done: number, total: number) => void,
): Promise<T | null> {
	try {
		const candidate = await fingerprintFile(file);
		const known = await fingerprintLibrary(library, onProgress);

		return findLookalike(candidate, known);
	} catch {
		return null;
	}
}
