"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { athensLocalToUTC } from "@/lib/date";
import { parseMapData } from "@/lib/outlook/schema";
import { LEGEND_POSITIONS, type LegendPosition, type MapData } from "@/lib/outlook/types";
import { createClient } from "@/lib/supabase/server";

type FormState = { error?: string };

type Parsed = {
	title: string;
	slug: string;
	summary: string;
	map_data: MapData;
	legend_position: LegendPosition;
	issued_at: string;
	valid_until: string | null;
	published: boolean;
};

function text(formData: FormData, key: string) {
	return String(formData.get(key) ?? "").trim();
}

function localToUtc(value: string): string | null {
	if (!value) return null;
	try {
		return athensLocalToUTC(value);
	} catch {
		return null;
	}
}

function parseForm(
	formData: FormData,
): { ok: true; value: Parsed } | { ok: false; error: string } {
	const title = text(formData, "title");
	const slug = text(formData, "slug");
	const summary = String(formData.get("summary") ?? "").trim();
	const legend = text(formData, "legend_position");
	const published = formData.get("published") === "on";

	if (title.length < 3 || title.length > 140) {
		return { ok: false, error: "Ο τίτλος πρέπει να έχει 3 έως 140 χαρακτήρες." };
	}

	if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 100) {
		return { ok: false, error: "Το slug επιτρέπει μόνο λατινικά πεζά, αριθμούς και παύλες." };
	}

	if (summary.length > 20000) {
		return { ok: false, error: "Το κείμενο είναι πολύ μεγάλο." };
	}

	if (!(LEGEND_POSITIONS as readonly { id: string }[]).some((p) => p.id === legend)) {
		return { ok: false, error: "Μη έγκυρη θέση υπομνήματος." };
	}

	const issued = localToUtc(text(formData, "issued_at"));

	if (!issued) {
		return { ok: false, error: "Η ημερομηνία έκδοσης είναι υποχρεωτική." };
	}

	const validRaw = text(formData, "valid_until");
	const validUntil = localToUtc(validRaw);

	if (validRaw && !validUntil) {
		return { ok: false, error: "Μη έγκυρη ημερομηνία ισχύος." };
	}

	if (validUntil && new Date(validUntil) <= new Date(issued)) {
		return { ok: false, error: "Η ισχύς πρέπει να λήγει μετά την έκδοση." };
	}

	const map = parseMapData(String(formData.get("map_data") ?? ""));

	if (!map.ok) {
		return { ok: false, error: map.error };
	}

	return {
		ok: true,
		value: {
			title,
			slug,
			summary,
			map_data: map.value,
			legend_position: legend as LegendPosition,
			issued_at: issued,
			valid_until: validUntil,
			published,
		},
	};
}

function refresh() {
	revalidatePath("/outlooks");
	revalidatePath("/outlooks/[slug]", "page");
	revalidatePath("/admin/outlooks");
	revalidatePath("/sitemap.xml");
}

function dbError(code: string | undefined) {
	return code === "23505"
		? "Υπάρχει ήδη χάρτης με αυτό το slug."
		: "Δεν ήταν δυνατή η αποθήκευση του χάρτη.";
}

export async function createOutlookAction(
	_prev: FormState,
	formData: FormData,
): Promise<FormState> {
	await requireAdmin();

	const parsed = parseForm(formData);
	if (!parsed.ok) return { error: parsed.error };

	const supabase = await createClient();

	const { error } = await supabase.from("outlooks").insert({
		...parsed.value,
		published_at: parsed.value.published ? new Date().toISOString() : null,
	});

	if (error) return { error: dbError(error.code) };

	refresh();
	redirect("/admin/outlooks");
}

export async function updateOutlookAction(
	_prev: FormState,
	formData: FormData,
): Promise<FormState> {
	await requireAdmin();

	const id = text(formData, "id");
	if (!id) return { error: "Μη έγκυρος χάρτης." };

	const parsed = parseForm(formData);
	if (!parsed.ok) return { error: parsed.error };

	const supabase = await createClient();

	const { data: existing, error: readError } = await supabase
		.from("outlooks")
		.select("published_at")
		.eq("id", id)
		.single();

	if (readError || !existing) return { error: "Ο χάρτης δεν βρέθηκε." };

	const publishedAt = parsed.value.published
		? (existing.published_at ?? new Date().toISOString())
		: null;

	const { error } = await supabase
		.from("outlooks")
		.update({ ...parsed.value, published_at: publishedAt })
		.eq("id", id);

	if (error) return { error: dbError(error.code) };

	refresh();
	redirect("/admin/outlooks");
}

export async function deleteOutlookAction(formData: FormData) {
	await requireAdmin();

	const id = text(formData, "id");
	if (!id) throw new Error("Μη έγκυρος χάρτης.");

	const supabase = await createClient();
	const { error } = await supabase.from("outlooks").delete().eq("id", id);

	if (error) throw new Error(error.message);

	refresh();
	redirect("/admin/outlooks");
}
