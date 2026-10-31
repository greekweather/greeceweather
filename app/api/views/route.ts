import { createHmac, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const MIN_GAP_MINUTES = 3;
const MAX_VIEWS_PER_DAY = 40;

// A random id per browser (24 hours, no personal data). Counting visitors by IP + browser string
// merged different people: everyone on the same mobile network or office with the same phone
// model looked like one visitor, so their views were dropped as repeats.
const VISITOR_COOKIE = "gw_vid";

// "bot" is matched as a word or as a known crawler name, so phone brands like "Cubot" still count.
const BOT_PATTERN =
	/(?:^|[^a-z])bot(?:[^a-z]|$)|googlebot|bingbot|slackbot|twitterbot|discordbot|telegrambot|crawl|spider|slurp|headless|preview|facebookexternalhit|monitor|curl|wget|python|axios|node-fetch/i;

// Best-effort throttle per server instance: 120 requests per minute per IP address.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 120;
const hits = new Map<string, { count: number; resetAt: number }>();

function isThrottled(key: string): boolean {
	const now = Date.now();

	if (hits.size > 5000) {
		hits.clear();
	}

	const entry = hits.get(key);

	if (!entry || entry.resetAt < now) {
		hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
		return false;
	}

	entry.count += 1;

	return entry.count > MAX_PER_WINDOW;
}

export async function POST(request: Request) {
	if (request.headers.get("content-type") !== "application/json") {
		return NextResponse.json({ error: "Unsupported media type" }, { status: 415 });
	}

	// Browsers always send Origin on cross-site POSTs: reject other sites.
	const origin = request.headers.get("origin");

	if (origin) {
		let sameSite = false;

		try {
			sameSite = new URL(origin).host === request.headers.get("host");
		} catch {}

		if (!sameSite) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}
	}

	const userAgent = request.headers.get("user-agent") ?? "";

	if (BOT_PATTERN.test(userAgent)) {
		return NextResponse.json({ ok: true, counted: false, reason: "bot" });
	}

	const body = await request.json().catch(() => null);
	const slug = typeof body?.slug === "string" ? body.slug : "";

	if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
		return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
	}

	const ip =
		request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
		request.headers.get("x-real-ip") ||
		"unknown";

	if (isThrottled(ip)) {
		return NextResponse.json({ error: "Too many requests", reason: "throttled" }, { status: 429 });
	}

	const cookieStore = await cookies();
	const key = `viewed_${slug}`;

	if (cookieStore.get(key)) {
		return NextResponse.json({ ok: true, counted: false, reason: "cookie" });
	}

	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

	if (!url || !serviceKey) {
		return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
	}

	const existingId = cookieStore.get(VISITOR_COOKIE)?.value;
	const visitorId = existingId && /^[0-9a-f-]{36}$/.test(existingId) ? existingId : randomUUID();

	// Only a hash of the random id reaches the database.
	const visitor = createHmac("sha256", serviceKey).update(visitorId).digest("hex");

	const supabase = createClient(url, serviceKey, {
		auth: { persistSession: false, autoRefreshToken: false },
	});

	const { data, error } = await supabase.rpc("increment_post_views", {
		p_slug: slug,
		p_visitor: visitor,
		p_min_gap_minutes: MIN_GAP_MINUTES,
		p_max_per_day: MAX_VIEWS_PER_DAY,
	});

	if (error) {
		return NextResponse.json(
			{ error: "Could not record view", reason: "db_error" },
			{ status: 500 },
		);
	}

	// The database answers with a reason ("counted", "gap", "daily_cap", "not_live");
	// the older version of the function answered true / false.
	const reason = typeof data === "string" ? data : data === true ? "counted" : "not_counted";

	const response = NextResponse.json({ ok: true, counted: reason === "counted", reason });

	const options = {
		httpOnly: true,
		sameSite: "lax" as const,
		secure: process.env.NODE_ENV === "production",
	};

	response.cookies.set(key, "1", { ...options, maxAge: 60 * MIN_GAP_MINUTES });
	response.cookies.set(VISITOR_COOKIE, visitorId, { ...options, maxAge: 60 * 60 * 24 });

	return response;
}
