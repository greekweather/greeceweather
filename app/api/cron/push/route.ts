import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron";
import { log, requestFields, safeError, timer } from "@/lib/log";
import { sendPendingNotifications } from "@/lib/push-notify";

export const dynamic = "force-dynamic";

// A run sends to every subscribed phone with a pause between notifications, which can take longer
// than the platform default. Without this the run could be cut off half way.
export const maxDuration = 60;

// Called every minute by the Supabase job in supabase/changes-2026-11-22.sql, with
// .github/workflows/push-check.yml as a backup (GitHub often delays or skips scheduled runs). It catches what was scheduled
// for later (a map whose issue time arrives, a banner whose start time arrives); anything saved
// in the admin is announced right away by the save itself.
export async function GET(request: Request) {
	if (!isCronAuthorized(request)) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const elapsed = timer();

	try {
		const summary = await sendPendingNotifications();

		log.info("cron.push.done", { ...requestFields(request), ms: elapsed(), summary });

		return NextResponse.json(summary);
	} catch (error) {
		log.critical("cron.push.failed", {
			...requestFields(request),
			ms: elapsed(),
			error: safeError(error),
		});

		return NextResponse.json({ error: "failed" }, { status: 500 });
	}
}
