import type { SupabaseClient } from "@supabase/supabase-js";
import { BACKUP_FORMAT, BACKUP_TABLES, type BackupFile, FULL_EXTRA_TABLES } from "@/lib/backup";
import { listAllFiles } from "@/lib/media";

// Reads every content table into a backup file. `full` adds the safety copies of deleted items
// and the list of uploaded images. Used by the admin download and by the daily automatic backup.
export async function buildBackup(
	supabase: SupabaseClient,
	full: boolean,
): Promise<{ ok: true; backup: BackupFile } | { ok: false; error: string }> {
	const tables: BackupFile["tables"] = {};

	for (const table of full ? [...BACKUP_TABLES, ...FULL_EXTRA_TABLES] : BACKUP_TABLES) {
		const rows: Record<string, unknown>[] = [];

		// one request returns at most 1000 rows
		for (let from = 0; ; from += 1000) {
			const { data, error } = await supabase
				.from(table)
				.select("*")
				.range(from, from + 999);

			if (error) {
				// the safety-copy table only exists after the SQL has been run: skip it rather than fail
				if ((FULL_EXTRA_TABLES as readonly string[]).includes(table)) break;

				return { ok: false, error: `${table}: ${error.message}` };
			}

			rows.push(...(data ?? []));

			if ((data?.length ?? 0) < 1000) break;
		}

		tables[table] = rows;
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

	return { ok: true, backup };
}
