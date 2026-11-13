import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { isPushEndpoint, sendPush, vapidKeys } from "@/lib/webpush";

export const dynamic = "force-dynamic";

const schema = z.object({ endpoint: z.string().max(600).refine(isPushEndpoint) });

// 3 tests per minute per address: it is a button for the visitor, not a way to send messages.
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

	return entry.count > 3;
}

// "Send me a test": sends one fixed message to ONE already-registered device, so a visitor can
// see that notifications really arrive. Only subscriptions saved in the database are used and
// the text cannot be chosen by the caller.
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

		if (!sameSite) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

	if (throttled(ip)) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

	const parsed = schema.safeParse(await request.json().catch(() => null));

	if (!parsed.success) {
		return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
	}

	if (!vapidKeys()) return NextResponse.json({ error: "no-keys" }, { status: 503 });

	try {
		const supabase = createServiceClient();
		const { data } = await supabase
			.from("push_subscriptions")
			.select("endpoint,p256dh,auth")
			.eq("endpoint", parsed.data.endpoint)
			.maybeSingle();

		// not saved on the server: as far as the site is concerned this device is gone
		if (!data) return NextResponse.json({ result: "gone" });

		const result = await sendPush(
			data,
			{
				title: "Δοκιμή ειδοποιήσεων",
				body: "Όλα καλά! Θα λαμβάνεις ειδοποίηση για νέους χάρτες και έκτακτα δελτία.",
				url: "/outlooks",
				tag: "push-test",
			},
			{ urgent: false },
		);

		if (result === "gone") {
			await supabase.from("push_subscriptions").delete().eq("endpoint", data.endpoint);
		}

		return NextResponse.json({ result });
	} catch {
		return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
	}
}
