import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const MIN_GAP_MINUTES = 3;
const MAX_VIEWS_PER_DAY = 15;

const BOT_PATTERN =
	/bot|crawl|spider|slurp|headless|preview|facebookexternalhit|monitor|curl|wget|python|axios|node-fetch/i;

// Best-effort throttle per server instance: 30 requests per minute per visitor.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
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
		return NextResponse.json({ ok: true, counted: false });
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
		return NextResponse.json({ error: "Too many requests" }, { status: 429 });
	}

	const cookieStore = await cookies();
	const key = `viewed_${slug}`;

	if (cookieStore.get(key)) {
		return NextResponse.json({ ok: true, counted: false });
	}

	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

	if (!url || !serviceKey) {
		return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
	}

	// Anonymous, non-reversible visitor id that changes every day.
	const day = new Date().toISOString().slice(0, 10);
	const visitor = createHmac("sha256", serviceKey)
		.update(`${ip}|${userAgent}|${day}`)
		.digest("hex");

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
		return NextResponse.json({ error: "Could not record view" }, { status: 500 });
	}

	const response = NextResponse.json({ ok: true, counted: data === true });

	response.cookies.set(key, "1", {
		httpOnly: true,
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
		maxAge: 60 * MIN_GAP_MINUTES,
	});

	return response;
}
