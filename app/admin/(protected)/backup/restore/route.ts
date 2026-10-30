import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/auth";
import { isBackupTable } from "@/lib/backup";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const MAX_ROWS = 200;

// Restores one batch of rows of one table. The admin page sends a backup file piece by piece.
//   mode "missing":   only rows that do not exist yet are added, nothing is changed.
//   mode "overwrite": existing rows with the same id are replaced by the backed-up version.
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

	if (!(await isAdminSession())) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const body = await request.json().catch(() => null);
	const table = body?.table;
	const rows: unknown = body?.rows;
	const mode = body?.mode === "overwrite" ? "overwrite" : "missing";

	if (
		!isBackupTable(table) ||
		!Array.isArray(rows) ||
		rows.length === 0 ||
		rows.length > MAX_ROWS ||
		rows.some((row) => !row || typeof row !== "object" || Array.isArray(row))
	) {
		return NextResponse.json({ error: "Invalid batch" }, { status: 400 });
	}

	const supabase = await createClient();

	const { error } = await supabase
		.from(table)
		.upsert(rows as Record<string, unknown>[], { ignoreDuplicates: mode === "missing" });

	if (error) {
		return NextResponse.json({ error: error.message }, { status: 400 });
	}

	return NextResponse.json({ ok: true, count: rows.length });
}
