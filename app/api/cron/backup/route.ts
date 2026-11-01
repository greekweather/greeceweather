import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { buildBackup } from "@/lib/backup-build";

export const dynamic = "force-dynamic";

function sameSecret(given: string, expected: string): boolean {
	const a = Buffer.from(given);
	const b = Buffer.from(expected);

	return a.length === b.length && timingSafeEqual(a, b);
}

// The daily automatic backup. A scheduler (the GitHub workflow .github/workflows/daily-backup.yml)
// calls this with "Authorization: Bearer <CRON_SECRET>" and stores the JSON it gets back.
// Without the secret (or with CRON_SECRET unset) it answers 403 and reads nothing.
export async function GET(request: Request) {
	const secret = process.env.CRON_SECRET;
	const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";

	if (!secret || secret.length < 16 || !sameSecret(given, secret)) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

	if (!url || !serviceKey) {
		return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
	}

	// the service role key sees everything, drafts and safety copies included
	const supabase = createClient(url, serviceKey, {
		auth: { persistSession: false, autoRefreshToken: false },
	});

	const result = await buildBackup(supabase, true);

	if (!result.ok) {
		return NextResponse.json({ error: result.error }, { status: 500 });
	}

	return new NextResponse(JSON.stringify(result.backup), {
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Cache-Control": "private, no-store",
		},
	});
}
