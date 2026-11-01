import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron";
import { sendPendingNotifications } from "@/lib/push-notify";

export const dynamic = "force-dynamic";

// Called every few minutes by .github/workflows/push-check.yml. It catches what was scheduled
// for later (a map whose issue time arrives, a banner whose start time arrives); anything saved
// in the admin is announced right away by the save itself.
export async function GET(request: Request) {
	if (!isCronAuthorized(request)) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	try {
		return NextResponse.json(await sendPendingNotifications());
	} catch (error) {
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "failed" },
			{ status: 500 },
		);
	}
}
