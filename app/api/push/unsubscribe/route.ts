import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { isPushEndpoint } from "@/lib/webpush";

export const dynamic = "force-dynamic";

const schema = z.object({ endpoint: z.string().max(600).refine(isPushEndpoint) });

// The phone turned notifications off: forget its subscription.
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

	const parsed = schema.safeParse(await request.json().catch(() => null));

	if (!parsed.success)
		return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });

	try {
		await createServiceClient()
			.from("push_subscriptions")
			.delete()
			.eq("endpoint", parsed.data.endpoint);
	} catch {
		return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
	}

	return NextResponse.json({ ok: true });
}
