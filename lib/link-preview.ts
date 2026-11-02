import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import zlib from "node:zlib";

// Reads the preview of a web page (title, description, picture) for the link cards in articles.
// It runs on the server, because a browser may not read other sites' pages (CORS), and it is
// careful, because it fetches addresses that visitors and authors choose (SSRF):
//   - only http:// and https://, only the ordinary ports 80 and 443
//   - every address the name resolves to is checked at connection time (so a name that points
//     to 127.0.0.1, 10.x.x.x, 192.168.x.x, 169.254.x.x ... is refused, also after a redirect)
//   - at most 3 redirects, 6 seconds in total, 400 KB of page read
//   - only HTML is read, and only the <meta> tags are looked at, never run

export type Preview = {
	url: string;
	domain: string;
	title: string | null;
	description: string | null;
	image: string | null;
	siteName: string | null;
};

const MAX_BYTES = 400 * 1024;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 6000;

// Sites that refuse bots or send them to a login page. They get a plain link card instead.
const NO_PREVIEW_HOSTS =
	/(^|\.)(facebook\.com|fb\.com|fb\.me|fb\.watch|fbcdn\.net|instagram\.com|threads\.net|linkedin\.com|x\.com|twitter\.com|t\.co)$/i;

export function hasNoPreview(hostname: string): boolean {
	return NO_PREVIEW_HOSTS.test(hostname);
}

// ---- addresses that must never be fetched -------------------------------------------------

function ipv4ToNumber(ip: string): number[] | null {
	const parts = ip.split(".").map(Number);

	return parts.length === 4 && parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)
		? parts
		: null;
}

function blockedV4(parts: number[]): boolean {
	const [a, b, c] = parts;

	return (
		a === 0 || // "this network"
		a === 10 || // private
		(a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
		a === 127 || // loopback
		(a === 169 && b === 254) || // link-local, cloud metadata (169.254.169.254)
		(a === 172 && b >= 16 && b <= 31) || // private
		(a === 192 && b === 0 && c === 0) || // IETF protocol assignments
		(a === 192 && b === 0 && c === 2) || // documentation
		(a === 192 && b === 168) || // private
		(a === 198 && (b === 18 || b === 19)) || // benchmarking
		(a === 198 && b === 51 && c === 100) || // documentation
		(a === 203 && b === 0 && c === 113) || // documentation
		a >= 224 // multicast, reserved, broadcast
	);
}

// 8 groups of 16 bits, or null if the text is not an IPv6 address.
function expandV6(ip: string): number[] | null {
	let text = ip.split("%")[0];

	// an IPv4 tail (::ffff:1.2.3.4) becomes two groups
	const tail = text.match(/(\d+\.\d+\.\d+\.\d+)$/);

	if (tail) {
		const v4 = ipv4ToNumber(tail[1]);

		if (!v4) return null;

		text = `${text.slice(0, -tail[1].length)}${((v4[0] << 8) | v4[1]).toString(16)}:${((v4[2] << 8) | v4[3]).toString(16)}`;
	}

	const halves = text.split("::");

	if (halves.length > 2) return null;

	const head = halves[0] ? halves[0].split(":") : [];
	const rest = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
	const missing = 8 - head.length - rest.length;

	if (halves.length === 1 ? head.length !== 8 : missing < 1) return null;

	const groups = [...head, ...(halves.length === 2 ? Array(missing).fill("0") : []), ...rest].map(
		(group) => Number.parseInt(group, 16),
	);

	return groups.length === 8 && groups.every((n) => Number.isInteger(n) && n >= 0 && n <= 0xffff)
		? groups
		: null;
}

export function isBlockedIp(ip: string): boolean {
	const family = net.isIP(ip);

	if (family === 4) {
		const parts = ipv4ToNumber(ip);

		return !parts || blockedV4(parts);
	}

	if (family === 6) {
		const g = expandV6(ip);

		if (!g) return true;

		// ::  and ::1
		if (g.slice(0, 7).every((n) => n === 0) && g[7] <= 1) return true;

		// IPv4 inside IPv6: ::ffff:a.b.c.d (mapped), ::a.b.c.d (compatible), 64:ff9b::/96 (NAT64)
		const embedded =
			(g.slice(0, 5).every((n) => n === 0) && g[5] === 0xffff) ||
			g.slice(0, 6).every((n) => n === 0) ||
			(g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((n) => n === 0));

		if (embedded) {
			return blockedV4([g[6] >> 8, g[6] & 255, g[7] >> 8, g[7] & 255]);
		}

		return (
			(g[0] & 0xfe00) === 0xfc00 || // fc00::/7 unique local
			(g[0] & 0xffc0) === 0xfe80 || // fe80::/10 link-local
			(g[0] & 0xffc0) === 0xfec0 || // fec0::/10 site-local (old)
			(g[0] & 0xff00) === 0xff00 || // multicast
			(g[0] === 0x2001 && g[1] === 0x0db8) // documentation
		);
	}

	return true;
}

type LookupCallback = (
	error: NodeJS.ErrnoException | null,
	address: string | dns.LookupAddress[],
	family?: number,
) => void;

// Used by the HTTP client instead of the normal name lookup: the addresses are checked in the
// same step that the connection uses, so the name cannot answer differently a second time.
function guardedLookup(allowPrivate: boolean) {
	return (hostname: string, options: dns.LookupOptions, callback: LookupCallback) => {
		dns.lookup(hostname, { ...options, all: true }, (error, addresses) => {
			if (error) {
				callback(error, "", 0);
				return;
			}

			if (!allowPrivate && addresses.some((entry) => isBlockedIp(entry.address))) {
				callback(Object.assign(new Error("blocked address"), { code: "EBLOCKED" }), "", 0);
				return;
			}

			if (options.all) {
				callback(null, addresses);
				return;
			}

			callback(null, addresses[0].address, addresses[0].family);
		});
	};
}

export function checkUrl(value: string, allowPrivate = false): URL | null {
	let url: URL;

	try {
		url = new URL(value);
	} catch {
		return null;
	}

	if (url.protocol !== "http:" && url.protocol !== "https:") return null;

	if (url.username || url.password) return null;

	if (url.port && url.port !== "80" && url.port !== "443" && !allowPrivate) return null;

	const host = url.hostname.replace(/^\[|\]$/g, "");

	// an address typed in directly is never looked up, so it is checked here
	if (!allowPrivate && net.isIP(host) && isBlockedIp(host)) return null;

	return url;
}

// ---- fetching -----------------------------------------------------------------------------

type Page = { html: string; finalUrl: URL } | null;

function readBody(response: http.IncomingMessage, signal: AbortSignal): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const encoding = String(response.headers["content-encoding"] ?? "").toLowerCase();
		let stream: NodeJS.ReadableStream = response;

		if (encoding === "gzip" || encoding === "x-gzip") stream = response.pipe(zlib.createGunzip());
		else if (encoding === "deflate") stream = response.pipe(zlib.createInflate());
		else if (encoding === "br") stream = response.pipe(zlib.createBrotliDecompress());

		const chunks: Buffer[] = [];
		let size = 0;
		let done = false;

		const finish = () => {
			if (done) return;

			done = true;
			response.destroy();
			resolve(Buffer.concat(chunks));
		};

		signal.addEventListener("abort", () => reject(new Error("timeout")), { once: true });

		stream.on("data", (chunk: Buffer) => {
			chunks.push(chunk);
			size += chunk.length;

			// the tags we need are in <head>: stop when it ends, and never read more than the limit
			if (size >= MAX_BYTES || chunk.toString("latin1").toLowerCase().includes("</head")) finish();
		});
		stream.on("end", finish);
		stream.on("error", (error) => (done ? undefined : reject(error)));
	});
}

function charsetOf(contentType: string, head: Buffer): string {
	const fromHeader = contentType.match(/charset=["']?([\w-]+)/i)?.[1];
	const fromMeta = head
		.subarray(0, 4096)
		.toString("latin1")
		.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1];

	return (fromHeader ?? fromMeta ?? "utf-8").toLowerCase();
}

function requestOnce(url: URL, signal: AbortSignal, allowPrivate: boolean) {
	return new Promise<http.IncomingMessage>((resolve, reject) => {
		const client = url.protocol === "https:" ? https : http;

		const request = client.request(
			url,
			{
				method: "GET",
				signal,
				lookup: guardedLookup(allowPrivate),
				headers: {
					"User-Agent":
						"Mozilla/5.0 (compatible; GreeceWeatherLinkPreview/1.0; +https://www.greeceweather.gr)",
					Accept: "text/html,application/xhtml+xml",
					"Accept-Language": "el,en;q=0.8",
					"Accept-Encoding": "gzip, deflate, br",
				},
			},
			resolve,
		);

		request.on("error", reject);
		request.end();
	});
}

export async function fetchPage(value: string, allowPrivate = false): Promise<Page> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

	try {
		let url = checkUrl(value, allowPrivate);

		for (let hop = 0; url && hop <= MAX_REDIRECTS; hop++) {
			const response = await requestOnce(url, controller.signal, allowPrivate);
			const status = response.statusCode ?? 0;
			const location = response.headers.location;

			if (status >= 300 && status < 400 && location) {
				response.resume();
				// every hop is checked again: a redirect to an internal address is refused
				url = checkUrl(new URL(location, url).href, allowPrivate);
				continue;
			}

			const type = String(response.headers["content-type"] ?? "");

			if (status < 200 || status >= 300 || !/text\/html|application\/xhtml/i.test(type)) {
				response.resume();
				return null;
			}

			const body = await readBody(response, controller.signal);
			const charset = charsetOf(type, body);

			let html: string;

			try {
				html = new TextDecoder(charset).decode(body);
			} catch {
				html = new TextDecoder("utf-8").decode(body);
			}

			return { html, finalUrl: url };
		}

		return null;
	} catch {
		return null;
	} finally {
		clearTimeout(timer);
	}
}

// ---- reading the tags ---------------------------------------------------------------------

const ENTITIES: Record<string, string> = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
	nbsp: " ",
	hellip: "…",
	ndash: "–",
	mdash: "—",
	laquo: "«",
	raquo: "»",
};

function decode(text: string): string {
	return text
		.replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeChar(Number.parseInt(hex, 16)))
		.replace(/&#(\d+);/g, (_, dec) => safeChar(Number(dec)))
		.replace(/&([a-z]+);/gi, (match, name) => ENTITIES[name.toLowerCase()] ?? match)
		.replace(/\s+/g, " ")
		.trim();
}

function safeChar(code: number): string {
	return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
}

function clip(text: string | undefined, max: number): string | null {
	if (!text) return null;

	const clean = decode(text);

	if (!clean) return null;

	return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

export function parsePreview(html: string, pageUrl: URL): Preview | null {
	const head = html.split(/<\/head/i)[0];
	const meta = new Map<string, string>();

	for (const tag of head.matchAll(/<meta\s+([^>]*?)\/?>/gi)) {
		const attributes = new Map<string, string>();

		for (const pair of tag[1].matchAll(
			/([a-zA-Z_:][-\w:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g,
		)) {
			attributes.set(pair[1].toLowerCase(), pair[2] ?? pair[3] ?? pair[4] ?? "");
		}

		const key = (attributes.get("property") ?? attributes.get("name") ?? "").toLowerCase();
		const content = attributes.get("content");

		if (key && content && !meta.has(key)) meta.set(key, content);
	}

	const titleTag = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];

	const title = clip(meta.get("og:title") ?? meta.get("twitter:title") ?? titleTag, 200);
	const description = clip(
		meta.get("og:description") ?? meta.get("twitter:description") ?? meta.get("description"),
		300,
	);

	let image: string | null = null;
	const rawImage =
		meta.get("og:image:secure_url") ?? meta.get("og:image") ?? meta.get("twitter:image");

	if (rawImage) {
		try {
			const resolved = new URL(decode(rawImage), pageUrl);

			if (resolved.protocol === "https:" || resolved.protocol === "http:") image = resolved.href;
		} catch {}
	}

	if (!title && !description && !image) return null;

	return {
		url: pageUrl.href,
		domain: pageUrl.hostname.replace(/^www\./, ""),
		title,
		description,
		image,
		siteName: clip(meta.get("og:site_name"), 80),
	};
}

export async function getPreview(value: string, allowPrivate = false): Promise<Preview | null> {
	const page = await fetchPage(value, allowPrivate);

	return page ? parsePreview(page.html, page.finalUrl) : null;
}
