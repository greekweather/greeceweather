import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/auth";
import { BACKUP_FORMAT, BACKUP_TABLES, type BackupFile, FULL_EXTRA_TABLES } from "@/lib/backup";
import { listAllFiles } from "@/lib/media";
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
	const supabase = await createClient();
	const tables: BackupFile["tables"] = {};

	for (const table of full ? [...BACKUP_TABLES, ...FULL_EXTRA_TABLES] : BACKUP_TABLES) {
		const { data, error } = await supabase.from(table).select("*");

		if (error) {
			// the safety-copy table only exists after the SQL has been run: skip it rather than fail
			if ((FULL_EXTRA_TABLES as readonly string[]).includes(table)) {
				tables[table] = [];
				continue;
			}

			return NextResponse.json({ error: `${table}: ${error.message}` }, { status: 500 });
		}

		tables[table] = data ?? [];
	}

	const backup: BackupFile = {
		format: BACKUP_FORMAT,
		version: 1,
		created_at: new Date().toISOString(),
		full,
		tables,
	};

	if (full) {
		const files = await listAllFiles(supabase);

		backup.storage = files.map((file) => ({
			name: file.name,
			url: supabase.storage.from("post-images").getPublicUrl(file.name).data.publicUrl,
		}));
	}

	const stamp = backup.created_at.slice(0, 16).replace(/[-:T]/g, "");

	return new NextResponse(JSON.stringify(backup), {
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Content-Disposition": `attachment; filename="greeceweather-${full ? "full" : "backup"}-${stamp}.json"`,
			"Cache-Control": "private, no-store",
		},
	});
}
