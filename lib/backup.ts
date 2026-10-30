// Tables included in a backup, in the order they must be restored (parents before children).
export const BACKUP_TABLES = [
	"tags",
	"posts",
	"post_tags",
	"outlooks",
	"weather_banner",
	"banner_forecast_posts",
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];

export const BACKUP_LABELS: Record<BackupTable, string> = {
	tags: "Ετικέτες",
	posts: "Άρθρα",
	post_tags: "Ετικέτες άρθρων",
	outlooks: "Χάρτες",
	weather_banner: "Μπάνερ",
	banner_forecast_posts: "Άρθρα πρόγνωσης μπάνερ",
};

export const BACKUP_FORMAT = "greeceweather-backup";

export type BackupFile = {
	format: typeof BACKUP_FORMAT;
	version: 1;
	created_at: string;
	tables: Record<BackupTable, Record<string, unknown>[]>;
};

export type RestoreMode = "missing" | "overwrite";

export function isBackupTable(value: unknown): value is BackupTable {
	return typeof value === "string" && (BACKUP_TABLES as readonly string[]).includes(value);
}

// Checks the shape of a parsed file; the rows themselves are validated by the database.
export function parseBackup(value: unknown): BackupFile | null {
	if (!value || typeof value !== "object") return null;

	const file = value as Partial<BackupFile>;

	if (file.format !== BACKUP_FORMAT || file.version !== 1 || !file.tables) return null;

	for (const table of BACKUP_TABLES) {
		const rows = file.tables[table];

		if (!Array.isArray(rows) || rows.some((row) => !row || typeof row !== "object")) return null;
	}

	return file as BackupFile;
}
