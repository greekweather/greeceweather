import { NextResponse } from "next/server";
import { checkUrl, getPreview, hasNoPreview, type Preview } from "@/lib/link-preview";

export const dynamic = "force-dynamic";

// GET /api/link-preview?url=https://example.com/page
//   { ok: true, preview: { url, domain, title, description, image, siteName } }
//   { ok: false, reason: "invalid" | "blocked-host" | "no-data" }
// Used by the link cards in articles. Results are remembered (see CACHE below) and also sent
// with cache headers, so the same link is not fetched again and again.

const OK_TTL_MS = 24 * 3600_000;
const FAIL_TTL_MS = 10 * 60_000;
const MAX_ENTRIES = 500;

type Entry = { at: number; ttl: number; preview: Preview | null };

const CACHE = new Map<string, Entry>();
const PENDING = new Map<string, Promise<Preview | null>>();

function remember(key: string, preview: Preview | null) {
	if (CACHE.size >= MAX_ENTRIES) {
		// drop the oldest entry (a Map keeps insertion order)
		const oldest = CACHE.keys().next().value;

		if (oldest !== undefined) CACHE.delete(oldest);
	}

	CACHE.set(key, { at: Date.now(), ttl: preview ? OK_TTL_MS : FAIL_TTL_MS, preview });
}

// Best-effort limit per server instance: 40 requests per minute per IP address.
const hits = new Map<string, { count: number; resetAt: number }>();

function throttled(key: string) {
	const now = Date.now();

	if (hits.size > 5000) hits.clear();

	const entry = hits.get(key);

	if (!entry || entry.resetAt < now) {
		hits.set(key, { count: 1, resetAt: now + 60_000 });
		return false;
	}

	entry.count += 1;

	return entry.count > 40;
}

function reply(body: Record<string, unknown>, cacheSeconds: number) {
	return NextResponse.json(body, {
		headers: {
			"Cache-Control": `public, s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 7}`,
		},
	});
}

export async function GET(request: Request) {
	// this is for the site's own pages: other sites may not use it as a free page reader
	const origin = request.headers.get("origin");

	if (origin) {
		let sameSite = false;

		try {
			sameSite = new URL(origin).host === request.headers.get("host");
		} catch {}

		if (!sameSite) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const site = request.headers.get("sec-fetch-site");

	if (site && site !== "same-origin" && site !== "none") {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

	if (throttled(ip)) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const value = new URL(request.url).searchParams.get("url") ?? "";
	const url = value.length <= 2048 ? checkUrl(value) : null;

	if (!url) return reply({ ok: false, reason: "invalid" }, 600);

	if (hasNoPreview(url.hostname)) return reply({ ok: false, reason: "blocked-host" }, 86400);

	const key = url.href;
	const cached = CACHE.get(key);

	if (cached && Date.now() - cached.at < cached.ttl) {
		return cached.preview
			? reply({ ok: true, preview: cached.preview }, 86400)
			: reply({ ok: false, reason: "no-data" }, 600);
	}

	// two visitors asking for the same link at once share one fetch
	let pending = PENDING.get(key);

	if (!pending) {
		pending = getPreview(key).finally(() => PENDING.delete(key));
		PENDING.set(key, pending);
	}

	const preview = await pending;

	remember(key, preview);

	return preview
		? reply({ ok: true, preview }, 86400)
		: reply({ ok: false, reason: "no-data" }, 600);
}
