// Visual duplicate check, entirely in the browser: every picture is shrunk to a 9x8 grey
// grid and one bit is kept per neighbouring pair (a "difference hash"). Copies, resized or
// recompressed versions of the same picture end up with almost the same 64 bits.

export type ImageFingerprint = {
	/** 128 bits: horizontal and vertical brightness steps of a 9x9 grey grid, as hex */
	hash: string;
	/** width / height */
	ratio: number;
	/** average colour of a 4x4 grid (r, g, b per cell), 0-255 */
	colors: number[];
};

const CACHE_KEY = "greeceweather:image-fingerprints:v2";
const MAX_HASH_DISTANCE = 16; // of 128 bits
const MAX_COLOR_DISTANCE = 26; // mean difference per channel, of 255
const MAX_SCANNED = 2000;

function sampleCanvas(source: CanvasImageSource, size: number): Uint8ClampedArray {
	const canvas = document.createElement("canvas");

	canvas.width = size;
	canvas.height = size;

	const ctx = canvas.getContext("2d", { willReadFrequently: true });

	if (!ctx) throw new Error("canvas");

	ctx.imageSmoothingEnabled = true;
	ctx.imageSmoothingQuality = "high";
	ctx.fillStyle = "#fff";
	ctx.fillRect(0, 0, size, size);
	ctx.drawImage(source, 0, 0, size, size);

	return ctx.getImageData(0, 0, size, size).data;
}

function fingerprint(source: CanvasImageSource, width: number, height: number): ImageFingerprint {
	const grid = sampleCanvas(source, 9);
	const gray = (x: number, y: number) => {
		const i = (y * 9 + x) * 4;

		return grid[i] * 0.299 + grid[i + 1] * 0.587 + grid[i + 2] * 0.114;
	};

	let bits = "";

	for (let y = 0; y < 8; y += 1) {
		for (let x = 0; x < 8; x += 1) bits += gray(x, y) > gray(x + 1, y) ? "1" : "0";
	}

	for (let y = 0; y < 8; y += 1) {
		for (let x = 0; x < 8; x += 1) bits += gray(x, y) > gray(x, y + 1) ? "1" : "0";
	}

	let hash = "";

	for (let i = 0; i < bits.length; i += 4) {
		hash += Number.parseInt(bits.slice(i, i + 4), 2).toString(16);
	}

	const tiny = sampleCanvas(source, 4);
	const colors: number[] = [];

	for (let i = 0; i < tiny.length; i += 4) colors.push(tiny[i], tiny[i + 1], tiny[i + 2]);

	return { hash, ratio: width / Math.max(1, height), colors };
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

function colorDistance(a: number[], b: number[]): number {
	let sum = 0;

	for (let i = 0; i < a.length; i += 1) sum += Math.abs(a[i] - b[i]);

	return sum / a.length;
}

// Same picture = nearly the same shape (hash), the same colours and the same proportions.
// Colours matter: two different charts on the same map have the same layout but not the same
// colours, and must not be called duplicates.
export function findLookalike<T extends { fingerprint: ImageFingerprint }>(
	candidate: ImageFingerprint,
	known: T[],
): T | null {
	let best: T | null = null;
	let bestDistance = MAX_HASH_DISTANCE + 1;

	for (const item of known) {
		const other = item.fingerprint;

		if (Math.abs(other.ratio - candidate.ratio) > 0.06) continue;
		if (colorDistance(candidate.colors, other.colors) > MAX_COLOR_DISTANCE) continue;

		const d = distance(candidate.hash, other.hash);

		if (d < bestDistance) {
			best = item;
			bestDistance = d;
		}
	}

	return best;
}

// ---- the index ----
// Every picture is fingerprinted once. The result is kept in this browser (keyed by the
// picture's address, which never changes for a stored file), so the next check only loads the
// pictures it has not seen yet. A new upload is added to the index at upload time, from the
// file already in hand, so it is never downloaded again either.
const MAX_INDEXED = 5000;

let index: Record<string, ImageFingerprint> | null = null;

function loadIndex(): Record<string, ImageFingerprint> {
	if (index) return index;

	try {
		index = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}");
	} catch {
		index = {};
	}

	return index ?? {};
}

function saveIndex() {
	const current = loadIndex();
	const keys = Object.keys(current);

	// keep it bounded: forget the oldest entries (insertion order) beyond the cap
	for (const key of keys.slice(0, Math.max(0, keys.length - MAX_INDEXED))) delete current[key];

	try {
		localStorage.setItem(CACHE_KEY, JSON.stringify(current));
	} catch {}
}

/** Adds a just-uploaded file to the index under its new address. Never throws. */
export async function indexUploaded(file: Blob, url: string): Promise<void> {
	try {
		loadIndex()[url] = await fingerprintFile(file);
		saveIndex();
	} catch {}
}

/**
 * Fingerprints of the library's images (newest first). Pictures already in the index are not
 * loaded again; only the missing ones are, a few at a time, and the index is saved as it
 * grows. A picture that cannot be read (blocked by the browser, deleted) is skipped; if
 * nothing can be read the result is simply empty and no duplicate warning ever shows.
 */
export async function fingerprintLibrary<T extends { url: string }>(
	images: T[],
	onProgress?: (done: number, total: number) => void,
): Promise<(T & { fingerprint: ImageFingerprint })[]> {
	const known = loadIndex();
	const list = images.slice(0, MAX_SCANNED);
	const missing = list.filter((item) => !known[item.url]);
	let done = 0;
	let next = 0;

	async function worker() {
		while (next < missing.length) {
			const item = missing[next];

			next += 1;

			try {
				known[item.url] = await fingerprintUrl(item.url);
			} catch {}

			done += 1;
			onProgress?.(done, missing.length);

			if (done % 10 === 0) saveIndex();
		}
	}

	if (missing.length > 0) {
		await Promise.all([worker(), worker(), worker(), worker()]);
		saveIndex();
	}

	return list.flatMap((item) =>
		known[item.url] ? [{ ...item, fingerprint: known[item.url] }] : [],
	);
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
