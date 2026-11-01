import { NextResponse } from "next/server";
import { buildBackup } from "@/lib/backup-build";
import { isCronAuthorized } from "@/lib/cron";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

// The daily automatic backup. A scheduler (the GitHub workflow .github/workflows/daily-backup.yml)
// calls this with "Authorization: Bearer <CRON_SECRET>" and stores the JSON it gets back.
// Without the secret (or with CRON_SECRET unset) it answers 403 and reads nothing.
export async function GET(request: Request) {
	if (!isCronAuthorized(request)) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	let supabase: ReturnType<typeof createServiceClient>;

	try {
		// the service role key sees everything, drafts and safety copies included
		supabase = createServiceClient();
	} catch {
		return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
	}

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
