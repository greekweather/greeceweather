import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

export type TrashKind = "posts" | "tags" | "outlooks" | "weather_banner";

export const TRASH_KIND_LABEL: Record<TrashKind, string> = {
	posts: "Άρθρο",
	tags: "Ετικέτα",
	outlooks: "Χάρτης",
	weather_banner: "Μπάνερ",
};

// Rows in other tables that disappear together with the item (they are saved with it).
const LINKED: Record<TrashKind, [table: string, column: string][]> = {
	posts: [
		["post_tags", "post_id"],
		["banner_forecast_posts", "post_id"],
	],
	tags: [["post_tags", "tag_id"]],
	outlooks: [],
	weather_banner: [["banner_forecast_posts", "banner_id"]],
};

const KEEP_DAYS = 90;

// Saves the item (and what is linked to it) to deleted_items BEFORE it is deleted. If the
// copy cannot be made the error stops the delete, so nothing is ever lost without a backup.
export async function saveBeforeDelete(
	supabase: Client,
	kind: TrashKind,
	id: string,
	label: string,
) {
	const { data: row, error } = await supabase.from(kind).select("*").eq("id", id).single();

	if (error || !row) {
		throw new Error(error?.message ?? "Το στοιχείο δεν βρέθηκε.");
	}

	const data: Record<string, unknown[]> = { [kind]: [row] };

	for (const [table, column] of LINKED[kind]) {
		const { data: rows, error: linkedError } = await supabase
			.from(table)
			.select("*")
			.eq(column, id);

		if (linkedError) throw new Error(linkedError.message);

		data[table] = rows ?? [];
	}

	const { error: insertError } = await supabase
		.from("deleted_items")
		.insert({ kind, label, data });

	if (insertError) {
		throw new Error(
			`Δεν έγινε αντίγραφο ασφαλείας πριν τη διαγραφή, οπότε δεν διαγράφηκε τίποτα. ` +
				`(${insertError.message}) Έχεις τρέξει το supabase/changes-2026-10-31.sql;`,
		);
	}

	const cutoff = new Date(Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000).toISOString();

	await supabase.from("deleted_items").delete().lt("created_at", cutoff);
}
