import { NextResponse } from "next/server";
import { z } from "zod";
import { hostOf, log, requestFields, safeError } from "@/lib/log";
import { PUSH_TOPICS, parseTopics } from "@/lib/push-topics";
import { createServiceClient } from "@/lib/supabase/service";
import { isPushEndpoint } from "@/lib/webpush";

export const dynamic = "force-dynamic";

const schema = z.object({
	endpoint: z.string().max(600).refine(isPushEndpoint),
	topics: z.array(z.enum(PUSH_TOPICS)).max(PUSH_TOPICS.length),
});

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

	return entry.count > 30;
}

// "Which notifications do I want?": changes the topics of ONE phone that is already saved.
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
			log.warn("push.preferences.cross_origin", {
				...requestFields(request),
				origin: hostOf(origin),
			});

			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}
	}

	const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

	if (throttled(ip)) {
		log.warn("push.preferences.throttled", requestFields(request));

		return NextResponse.json({ error: "Too many requests" }, { status: 429 });
	}

	const parsed = schema.safeParse(await request.json().catch(() => null));

	if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

	const topics = parseTopics(parsed.data.topics);

	try {
		const { data, error } = await createServiceClient()
			.from("push_subscriptions")
			.update({ topics } as Record<never, never>)
			.eq("endpoint", parsed.data.endpoint)
			.select("endpoint");

		if (error) throw error;

		if (!data || data.length === 0) {
			// not saved on the server: the phone has to subscribe again
			return NextResponse.json({ error: "Unknown subscription" }, { status: 404 });
		}
	} catch (error) {
		log.error("push.preferences.failed", { ...requestFields(request), error: safeError(error) });

		return NextResponse.json({ error: "Could not save" }, { status: 500 });
	}

	log.info("push.preferences.saved", {
		...requestFields(request),
		pushService: hostOf(parsed.data.endpoint),
		topics,
	});

	return NextResponse.json({ ok: true, topics });
}
