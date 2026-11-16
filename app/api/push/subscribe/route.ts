import { NextResponse } from "next/server";
import { z } from "zod";
import { hostOf, log, requestFields, safeError } from "@/lib/log";
import { createServiceClient } from "@/lib/supabase/service";
import { isPushEndpoint } from "@/lib/webpush";

export const dynamic = "force-dynamic";

const byteLength = (value: string) => Buffer.from(value, "base64url").length;

const schema = z.object({
	endpoint: z.string().max(600).refine(isPushEndpoint),
	keys: z.object({
		p256dh: z
			.string()
			.max(120)
			.refine((value) => byteLength(value) === 65),
		auth: z
			.string()
			.max(60)
			.refine((value) => byteLength(value) === 16),
	}),
});

// Best-effort throttle per server instance: 20 requests per minute per IP address.
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

	return entry.count > 20;
}

// A phone that turned notifications on sends its subscription here. Anyone can subscribe
// (it is a public site), so the address must be a real browser push service and the keys
// must have the right size; nothing else is stored.
export async function POST(request: Request) {
	if (request.headers.get("content-type")?.startsWith("application/json") !== true) {
		return NextResponse.json({ error: "Unsupported media type" }, { status: 415 });
	}

	const origin = request.headers.get("origin");

	if (origin) {
		let sameSite = false;

		try {
			sameSite = new URL(origin).host === request.headers.get("host");
		} catch {}

		if (!sameSite) {
			log.warn("push.subscribe.cross_origin", {
				...requestFields(request),
				origin: hostOf(origin),
			});

			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}
	}

	const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

	if (throttled(ip)) {
		log.warn("push.subscribe.throttled", requestFields(request));

		return NextResponse.json({ error: "Too many requests" }, { status: 429 });
	}

	const parsed = schema.safeParse(await request.json().catch(() => null));

	if (!parsed.success) {
		log.warn("push.subscribe.invalid", {
			...requestFields(request),
			fields: parsed.error.issues.map((issue) => issue.path.join(".")),
		});

		return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
	}

	let supabase: ReturnType<typeof createServiceClient>;

	try {
		supabase = createServiceClient();
	} catch (error) {
		log.error("push.subscribe.misconfigured", {
			...requestFields(request),
			error: safeError(error),
		});

		return NextResponse.json(
			{ error: "Server misconfigured", reason: "no-service-key" },
			{ status: 500 },
		);
	}

	const { error } = await supabase.from("push_subscriptions").upsert(
		{
			endpoint: parsed.data.endpoint,
			p256dh: parsed.data.keys.p256dh,
			auth: parsed.data.keys.auth,
			user_agent: (request.headers.get("user-agent") ?? "").slice(0, 200),
		},
		{ onConflict: "endpoint" },
	);

	if (error) {
		log.error("push.subscribe.save_failed", {
			...requestFields(request),
			pushService: hostOf(parsed.data.endpoint),
			error: safeError(error),
		});

		// 42P01 / PGRST205: the table does not exist (the SQL was not run)
		const missingTable = error.code === "42P01" || error.code === "PGRST205";

		return NextResponse.json(
			{ error: "Could not save", reason: missingTable ? "table-missing" : "save-failed" },
			{ status: 500 },
		);
	}

	log.info("push.subscribe.saved", {
		...requestFields(request),
		pushService: hostOf(parsed.data.endpoint),
	});

	return NextResponse.json({ ok: true });
}
