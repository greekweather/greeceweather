import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/auth";
import { BACKUP_FORMAT, BACKUP_TABLES, type BackupFile } from "@/lib/backup";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Every row of every content table as one JSON file. Admin only; never cached.
export async function GET() {
	if (!(await isAdminSession())) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const supabase = await createClient();
	const tables = {} as BackupFile["tables"];

	for (const table of BACKUP_TABLES) {
		const { data, error } = await supabase.from(table).select("*");

		if (error) {
			return NextResponse.json({ error: `${table}: ${error.message}` }, { status: 500 });
		}

		tables[table] = data ?? [];
	}

	const backup: BackupFile = {
		format: BACKUP_FORMAT,
		version: 1,
		created_at: new Date().toISOString(),
		tables,
	};

	const stamp = backup.created_at.slice(0, 16).replace(/[-:T]/g, "");

	return new NextResponse(JSON.stringify(backup), {
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Content-Disposition": `attachment; filename="greeceweather-backup-${stamp}.json"`,
			"Cache-Control": "private, no-store",
		},
	});
}
