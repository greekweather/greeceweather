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

type RestoreOutcome = { ok: true } | { ok: false; conflict: boolean; message: string };

// Puts one safety copy back (with its links, e.g. an article's tags) and removes the copy.
// A copy whose slug is already used by something else is NOT an error that stops everything:
// it is left in place and reported as a conflict.
async function restoreOne(
	supabase: Supabase,
	id: string,
	rawData: unknown,
): Promise<RestoreOutcome> {
	const data = rawData as Record<string, Record<string, unknown>[]>;

	// parents before links, so the foreign keys are satisfied
	for (const table of BACKUP_TABLES) {
		const rows = data[table];

		if (!Array.isArray(rows) || rows.length === 0) continue;

		const { error: restoreError } = await supabase
			.from(table)
			.upsert(rows, { ignoreDuplicates: true });

		if (restoreError) {
			return {
				ok: false,
				// 23505: unique violation (the same slug already exists)
				conflict: restoreError.code === "23505",
				message: `Η επαναφορά απέτυχε (${table}): ${restoreError.message}`,
			};
		}
	}

	await supabase.from("deleted_items").delete().eq("id", id);

	return { ok: true };
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

	const outcome = await restoreOne(supabase, item.id, item.data);

	if (!outcome.ok) {
		if (outcome.conflict) redirect("/admin/backup?skipped=1");

		throw new Error(outcome.message);
	}

	refreshEverything();
	redirect("/admin/backup?restored=1");
}

// Puts back EVERY safety copy, oldest first (so a tag comes back before the article that uses
// it). A copy that cannot come back because its slug is taken is skipped and stays in the list;
// the others carry on. Any other error stops the run and says how far it got.
export async function restoreAllDeletedAction() {
	await requireAdmin();

	const supabase = await createClient();
	const { data: items, error } = await supabase
		.from("deleted_items")
		.select("id,data")
		.order("created_at", { ascending: true });

	if (error) throw new Error(error.message);

	let restored = 0;
	let skipped = 0;

	for (const item of items ?? []) {
		const outcome = await restoreOne(supabase, item.id, item.data);

		if (outcome.ok) {
			restored += 1;
		} else if (outcome.conflict) {
			skipped += 1;
		} else {
			refreshEverything();

			throw new Error(`Επανήλθαν ${restored} από ${items?.length ?? 0}. ${outcome.message}`);
		}
	}

	refreshEverything();
	redirect(`/admin/backup?restored=${restored}&skipped=${skipped}`);
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
