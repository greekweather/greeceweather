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

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Puts one safety copy back (with its links, e.g. an article's tags) and removes the copy.
async function restoreOne(supabase: Supabase, id: string, rawData: unknown) {
	const data = rawData as Record<string, Record<string, unknown>[]>;

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

	await restoreOne(supabase, item.id, item.data);

	refreshEverything();
	redirect("/admin/backup?restored=1");
}

// Puts back EVERY safety copy, oldest first (so a tag comes back before the article that uses
// it). Stops at the first failure and says how many came back.
export async function restoreAllDeletedAction() {
	await requireAdmin();

	const supabase = await createClient();
	const { data: items, error } = await supabase
		.from("deleted_items")
		.select("id,data")
		.order("created_at", { ascending: true });

	if (error) throw new Error(error.message);

	let restored = 0;

	for (const item of items ?? []) {
		try {
			await restoreOne(supabase, item.id, item.data);
			restored += 1;
		} catch (restoreError) {
			refreshEverything();

			throw new Error(
				`Επανήλθαν ${restored} από ${items?.length ?? 0}. ${
					restoreError instanceof Error ? restoreError.message : "Άγνωστο σφάλμα."
				}`,
			);
		}
	}

	refreshEverything();
	redirect(`/admin/backup?restored=${restored}`);
}

// Removes EVERY safety copy for good.
export async function purgeAllDeletedAction() {
	await requireAdmin();

	const supabase = await createClient();
	const { error } = await supabase.from("deleted_items").delete().not("id", "is", null);

	if (error) throw new Error(error.message);

	revalidatePath("/admin/backup");
	redirect("/admin/backup");
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
