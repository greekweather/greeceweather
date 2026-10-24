import { cache } from "react";
import { mapDataFromDb } from "@/lib/outlook/schema";
import type { LegendPosition, MapData } from "@/lib/outlook/types";
import { createPublicClient } from "@/lib/supabase/public";

export type Outlook = {
	id: string;
	title: string;
	slug: string;
	summary: string;
	map_data: MapData;
	legend_position: LegendPosition;
	issued_at: string;
	valid_until: string | null;
	published: boolean;
	published_at: string | null;
	created_at: string;
	updated_at: string;
};

type OutlookRow = Omit<Outlook, "map_data"> & { map_data: unknown };

export const OUTLOOK_COLUMNS =
	"id,title,slug,summary,map_data,legend_position,issued_at,valid_until,published,published_at,created_at,updated_at";

export function toOutlook(row: OutlookRow): Outlook {
	return { ...row, map_data: mapDataFromDb(row.map_data) };
}

export const getPublishedOutlooks = cache(async (): Promise<Outlook[]> => {
	const supabase = createPublicClient();

	const { data, error } = await supabase
		.from("outlooks")
		.select(OUTLOOK_COLUMNS)
		.eq("published", true)
		.not("published_at", "is", null)
		.lte("published_at", new Date().toISOString())
		.lte("issued_at", new Date().toISOString())
		.order("issued_at", { ascending: false });

	if (error) {
		throw new Error("Δεν ήταν δυνατή η φόρτωση των χαρτών.");
	}

	return ((data ?? []) as unknown as OutlookRow[]).map(toOutlook);
});

export const getPublishedOutlookBySlug = cache(async (slug: string): Promise<Outlook | null> => {
	const supabase = createPublicClient();

	const { data, error } = await supabase
		.from("outlooks")
		.select(OUTLOOK_COLUMNS)
		.eq("slug", slug)
		.eq("published", true)
		.not("published_at", "is", null)
		.lte("published_at", new Date().toISOString())
		.lte("issued_at", new Date().toISOString())
		.maybeSingle();

	if (error) {
		throw new Error("Δεν ήταν δυνατή η φόρτωση του χάρτη.");
	}

	return data ? toOutlook(data as unknown as OutlookRow) : null;
});
