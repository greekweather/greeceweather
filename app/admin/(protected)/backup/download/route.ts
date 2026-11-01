import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/auth";
import { buildBackup } from "@/lib/backup-build";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Every row of every content table as one JSON file. Admin only; never cached.
//   /admin/backup/download          articles, tags, maps, banners
//   /admin/backup/download?full=1   the same plus the safety copies of deleted items and a list
//                                   of the uploaded images
export async function GET(request: Request) {
	if (!(await isAdminSession())) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const full = new URL(request.url).searchParams.get("full") === "1";
	const result = await buildBackup(await createClient(), full);

	if (!result.ok) {
		return NextResponse.json({ error: result.error }, { status: 500 });
	}

	const { backup } = result;
	const stamp = backup.created_at.slice(0, 16).replace(/[-:T]/g, "");

	return new NextResponse(JSON.stringify(backup), {
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Content-Disposition": `attachment; filename="greeceweather-${full ? "full" : "backup"}-${stamp}.json"`,
			"Cache-Control": "private, no-store",
		},
	});
}
