"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { BACKUP_TABLES } from "@/lib/backup";
import { createClient } from "@/lib/supabase/server";

function refreshEverything() {
	revalidatePath("/", "layout");
	revalidatePath("/admin/backup");
}

// Puts a deleted item (and its links, e.g. an article's tags) back exactly as it was.
export async function restoreDeletedAction(formData: FormData) {
	await requireAdmin();

	const id = String(formData.get("id") ?? "");

	if (!id) throw new Error("Μη έγκυρο αντίγραφο.");

	const supabase = await createClient();

	const { data: item, error } = await supabase
		.from("deleted_items")
		.select("id,data")
		.eq("id", id)
		.single();

	if (error || !item) throw new Error(error?.message ?? "Το αντίγραφο δεν βρέθηκε.");

	const data = item.data as Record<string, Record<string, unknown>[]>;

	// parents before links, so the foreign keys are satisfied
	for (const table of BACKUP_TABLES) {
		const rows = data[table];

		if (!Array.isArray(rows) || rows.length === 0) continue;

		const { error: restoreError } = await supabase
			.from(table)
			.upsert(rows, { ignoreDuplicates: true });

		if (restoreError) {
			throw new Error(`Η επαναφορά απέτυχε (${table}): ${restoreError.message}`);
		}
	}

	await supabase.from("deleted_items").delete().eq("id", id);

	refreshEverything();
	redirect("/admin/backup?restored=1");
}

// Removes a safety copy for good.
export async function purgeDeletedAction(formData: FormData) {
	await requireAdmin();

	const id = String(formData.get("id") ?? "");

	if (!id) throw new Error("Μη έγκυρο αντίγραφο.");

	const supabase = await createClient();
	const { error } = await supabase.from("deleted_items").delete().eq("id", id);

	if (error) throw new Error(error.message);

	revalidatePath("/admin/backup");
	redirect("/admin/backup");
}
