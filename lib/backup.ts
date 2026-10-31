// Content tables included in every backup, in the order they must be restored (parents first).
export const BACKUP_TABLES = [
	"tags",
	"posts",
	"post_tags",
	"outlooks",
	"weather_banner",
	"banner_forecast_posts",
] as const;

// Added by the "full" backup: the safety copies of deleted items.
export const FULL_EXTRA_TABLES = ["deleted_items"] as const;

export const ALL_BACKUP_TABLES = [...BACKUP_TABLES, ...FULL_EXTRA_TABLES] as const;

export type BackupTable = (typeof ALL_BACKUP_TABLES)[number];

export const BACKUP_LABELS: Record<BackupTable, string> = {
	tags: "Ετικέτες",
	posts: "Άρθρα",
	post_tags: "Ετικέτες άρθρων",
	outlooks: "Χάρτες",
	weather_banner: "Μπάνερ",
	banner_forecast_posts: "Άρθρα πρόγνωσης μπάνερ",
	deleted_items: "Αντίγραφα διαγραμμένων",
};

export const BACKUP_FORMAT = "greeceweather-backup";

export type BackupFile = {
	format: typeof BACKUP_FORMAT;
	version: 1;
	created_at: string;
	full?: boolean;
	tables: Partial<Record<BackupTable, Record<string, unknown>[]>>;
	/** Full backups: names and links of the uploaded images (the files themselves are not inside). */
	storage?: { name: string; url: string }[];
};

export type RestoreMode = "missing" | "overwrite";

export function isBackupTable(value: unknown): value is BackupTable {
	return typeof value === "string" && (ALL_BACKUP_TABLES as readonly string[]).includes(value);
}

// Checks the shape of a parsed file; the rows themselves are validated by the database.
export function parseBackup(value: unknown): BackupFile | null {
	if (!value || typeof value !== "object") return null;

	const file = value as Partial<BackupFile>;

	if (file.format !== BACKUP_FORMAT || file.version !== 1 || !file.tables) return null;

	for (const table of ALL_BACKUP_TABLES) {
		const rows = file.tables[table];

		if (rows === undefined && !(BACKUP_TABLES as readonly string[]).includes(table)) continue;

		if (!Array.isArray(rows) || rows.some((row) => !row || typeof row !== "object")) return null;
	}

	return file as BackupFile;
}
