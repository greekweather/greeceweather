import { NextResponse } from "next/server";
import { buildBackup } from "@/lib/backup-build";
import { isCronAuthorized } from "@/lib/cron";
import { log, requestFields, safeError, timer } from "@/lib/log";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

// The daily automatic backup. A scheduler (the GitHub workflow .github/workflows/daily-backup.yml)
// calls this with "Authorization: Bearer <CRON_SECRET>" and stores the JSON it gets back.
// Without the secret (or with CRON_SECRET unset) it answers 403 and reads nothing.
export async function GET(request: Request) {
	if (!isCronAuthorized(request)) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const elapsed = timer();
	let supabase: ReturnType<typeof createServiceClient>;

	try {
		// the service role key sees everything, drafts and safety copies included
		supabase = createServiceClient();
	} catch (error) {
		log.error("cron.backup.misconfigured", { ...requestFields(request), error: safeError(error) });

		return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
	}

	const result = await buildBackup(supabase, true);

	if (!result.ok) {
		log.error("cron.backup.failed", {
			...requestFields(request),
			ms: elapsed(),
			error: safeError(new Error(result.error)),
		});

		return NextResponse.json({ error: "Backup failed" }, { status: 500 });
	}

	log.info("cron.backup.done", {
		...requestFields(request),
		ms: elapsed(),
		tables: Object.fromEntries(
			Object.entries(result.backup.tables).map(([name, rows]) => [name, rows?.length ?? 0]),
		),
	});

	return new NextResponse(JSON.stringify(result.backup), {
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Cache-Control": "private, no-store",
		},
	});
}
