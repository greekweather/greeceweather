import { z } from "zod";
import { round3 } from "@/lib/outlook/geo";
import {
	LIMITS,
	MARKER_SIZE,
	MAX_PRESSURE,
	type MapData,
	MIN_PRESSURE,
} from "@/lib/outlook/types";

// Everything that comes from the browser is checked again here, on the server.

const id = z.string().min(1).max(64);
const coord = z.number().min(-200).max(200);
const horizon = z.enum(["48h", "7d"]);
const chance = z.number().int().min(0).max(100);

const ellipse = z.object({
	id,
	kind: z.literal("area"),
	shape: z.literal("ellipse"),
	horizon,
	chance,
	x: coord,
	y: coord,
	rx: z.number().min(0.05).max(120),
	ry: z.number().min(0.05).max(120),
	rot: z.number().min(-720).max(720),
});

const polygon = z.object({
	id,
	kind: z.literal("area"),
	shape: z.literal("polygon"),
	horizon,
	chance,
	points: z
		.array(z.tuple([coord, coord]))
		.min(3)
		.max(LIMITS.polygonPoints),
});

const marker = z.object({
	id,
	kind: z.literal("x"),
	x: coord,
	y: coord,
	label: z.string().trim().max(30),
	chance: z.number().int().min(0).max(100).nullable().optional(),
	size: z.number().int().min(MARKER_SIZE.min).max(MARKER_SIZE.max).optional(),
});

const storm = z.object({
	id,
	kind: z.literal("storm"),
	x: coord,
	y: coord,
	name: z.string().trim().max(40),
	pressure: z.number().int().min(MIN_PRESSURE).max(MAX_PRESSURE),
	type: z.enum(["td", "ts", "hu", "et", "sd", "ss", "med"]).nullable(),
	note: z.string().trim().max(80),
	labelPos: z.enum(["right", "left", "top", "bottom"]),
});

export const mapDataSchema = z.object({
	v: z.literal(1),
	areas: z.array(z.discriminatedUnion("shape", [ellipse, polygon])).max(LIMITS.areas),
	markers: z.array(marker).max(LIMITS.markers),
	storms: z.array(storm).max(LIMITS.storms),
});

const MAX_JSON_CHARS = 200_000;

export type ParseResult = { ok: true; value: MapData } | { ok: false; error: string };

function hasUniqueIds(data: MapData): boolean {
	const ids = [...data.areas, ...data.markers, ...data.storms].map((item) => item.id);
	return new Set(ids).size === ids.length;
}

function roundPoint(p: [number, number]): [number, number] {
	return [round3(p[0]), round3(p[1])];
}

/** Parses and validates the JSON sent by the editor. */
export function parseMapData(raw: string): ParseResult {
	if (raw.length > MAX_JSON_CHARS) {
		return { ok: false, error: "Τα δεδομένα του χάρτη είναι πολύ μεγάλα." };
	}

	let json: unknown;

	try {
		json = JSON.parse(raw);
	} catch {
		return { ok: false, error: "Μη έγκυρα δεδομένα χάρτη." };
	}

	const parsed = mapDataSchema.safeParse(json);

	if (!parsed.success) {
		return { ok: false, error: "Μη έγκυρα δεδομένα χάρτη. Έλεγξε τα σχήματα και τις τιμές." };
	}

	const value: MapData = {
		v: 1,
		areas: parsed.data.areas.map((area) =>
			area.shape === "ellipse"
				? {
						...area,
						x: round3(area.x),
						y: round3(area.y),
						rx: round3(area.rx),
						ry: round3(area.ry),
						rot: round3(area.rot),
					}
				: { ...area, points: area.points.map(roundPoint) },
		),
		markers: parsed.data.markers.map((m) => ({ ...m, x: round3(m.x), y: round3(m.y) })),
		storms: parsed.data.storms.map((s) => ({ ...s, x: round3(s.x), y: round3(s.y) })),
	};

	if (!hasUniqueIds(value)) {
		return { ok: false, error: "Μη έγκυρα δεδομένα χάρτη (διπλά αναγνωριστικά)." };
	}

	return { ok: true, value };
}

/** Reads map_data coming from the database; falls back to an empty map when it is damaged. */
export function mapDataFromDb(raw: unknown): MapData {
	const parsed = mapDataSchema.safeParse(raw);
	return parsed.success ? (parsed.data as MapData) : { v: 1, areas: [], markers: [], storms: [] };
}
