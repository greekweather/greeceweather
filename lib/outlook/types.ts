// Data model and rules for the outlook graphic.

type Horizon = "48h" | "7d";

export const HORIZONS: { id: Horizon; label: string }[] = [
	{ id: "48h", label: "Εντός 48 ωρών" },
	{ id: "7d", label: "Εντός 7 ημερών" },
];

export type ChanceCategory = "none" | "low" | "medium" | "high";

export const CHANCE_STYLE: Record<
	ChanceCategory,
	{ label: string; range: string; fill: string; stroke: string }
> = {
	// NHC: gray = "development not expected (near 0%)"
	none: { label: "Μηδενική", range: "≈0%", fill: "#9aa3ab", stroke: "#5f6870" },
	low: { label: "Χαμηλή", range: "<40%", fill: "#ffe600", stroke: "#b89b00" },
	medium: { label: "Μέση", range: "40–60%", fill: "#ff9a00", stroke: "#b86b00" },
	high: { label: "Υψηλή", range: ">60%", fill: "#ff2b1c", stroke: "#a30f06" },
};

/** None (gray): near 0 %. Low: below 40 %. Medium: 40-60 %. High: above 60 %. */
export function chanceCategory(chance: number): ChanceCategory {
	if (chance < 5) return "none";
	if (chance < 40) return "low";
	if (chance <= 60) return "medium";
	return "high";
}

export type PressureClassId = "low" | "significant" | "deep" | "very-deep";

export type PressureClass = {
	id: PressureClassId;
	name: string;
	/** Lowest pressure of the class, in hPa (inclusive). */
	min: number;
	/** Highest pressure of the class, in hPa (inclusive). */
	max: number;
	/** Number of closed isobar rings drawn around the symbol. */
	rings: number;
	color: string;
	range: string;
};

// Colours go from cool to hot as the pressure falls: blue, amber, red, violet. They are used by
// the storm symbols AND by the tracks, so a colour always means the same strength.
export const MIN_PRESSURE = 870;
export const MAX_PRESSURE = 1015;

export const PRESSURE_CLASSES: PressureClass[] = [
	{
		id: "low",
		name: "Περιοχή χαμηλής πίεσης",
		min: 1000,
		max: MAX_PRESSURE,
		rings: 1,
		color: "#2f86d6",
		range: "1000–1015 hPa",
	},
	{
		id: "significant",
		name: "Σημαντικό χαμηλό",
		min: 990,
		max: 999,
		rings: 2,
		color: "#e39500",
		range: "990–999 hPa",
	},
	{
		id: "deep",
		name: "Βαθύ χαμηλό",
		min: 975,
		max: 989,
		rings: 3,
		color: "#d9302a",
		range: "975–989 hPa",
	},
	{
		id: "very-deep",
		name: "Πολύ βαθύ χαμηλό",
		min: MIN_PRESSURE,
		max: 974,
		rings: 4,
		color: "#8f2aa8",
		range: "974 hPa και χαμηλότερα",
	},
];

/** The class for a central pressure in hPa, or null when it is not a low (above 1015). */
export function pressureClass(hpa: number): PressureClass | null {
	const rounded = Math.round(hpa);
	return PRESSURE_CLASSES.find((c) => rounded >= c.min && rounded <= c.max) ?? null;
}

export type StormTypeId = "td" | "ts" | "hu" | "et" | "sd" | "ss" | "med";
type StormFamily = "tropical" | "subtropical" | "extratropical" | "medicane";

export type StormType = {
	id: StormTypeId;
	code: string;
	name: string;
	family: StormFamily;
};

export const STORM_TYPES: StormType[] = [
	{ id: "td", code: "TD", name: "Τροπική ύφεση", family: "tropical" },
	{ id: "ts", code: "TS", name: "Τροπική καταιγίδα", family: "tropical" },
	{ id: "hu", code: "H", name: "Τυφώνας", family: "tropical" },
	{ id: "med", code: "M", name: "Μεσογειακός κυκλώνας (Medicane)", family: "medicane" },
	{ id: "et", code: "ET", name: "Εξωτροπικός κυκλώνας", family: "extratropical" },
	{ id: "sd", code: "SD", name: "Υποτροπική ύφεση", family: "subtropical" },
	{ id: "ss", code: "SS", name: "Υποτροπική καταιγίδα", family: "subtropical" },
];

export function stormType(id: StormTypeId | null): StormType | null {
	return STORM_TYPES.find((t) => t.id === id) ?? null;
}

/** Letter shown in the middle of the symbol when the low has no special type. */
export const PLAIN_LOW_CODE = "L";

export type LabelPos = "right" | "left" | "top" | "bottom";

export const LABEL_POSITIONS: { id: LabelPos; label: string }[] = [
	{ id: "right", label: "Δεξιά" },
	{ id: "left", label: "Αριστερά" },
	{ id: "top", label: "Πάνω" },
	{ id: "bottom", label: "Κάτω" },
];

type AreaBase = {
	id: string;
	kind: "area";
	horizon: Horizon;
	/** Formation chance in percent, 0-100. */
	chance: number;
};

export type EllipseArea = AreaBase & {
	shape: "ellipse";
	/** Centre, in map degrees. */
	x: number;
	y: number;
	/** Semi-axes, in map degrees. rx is the long axis. */
	rx: number;
	ry: number;
	/** Angle of the long axis, degrees counter-clockwise from east. */
	rot: number;
};

export type PolygonArea = AreaBase & {
	shape: "polygon";
	/** Vertices in map degrees. The outline is smoothed when drawn. */
	points: [number, number][];
};

export type Area = EllipseArea | PolygonArea;

export type XMarker = {
	id: string;
	kind: "x";
	x: number;
	y: number;
	label: string;
	/** 48-hour chance that colours the X like the NHC does; null/absent = plain black X. */
	chance?: number | null;
	/** Size of the X in percent of the standard one. Absent = 100. */
	size?: number;
};

export const MARKER_SIZE = { min: 30, max: 500, step: 5, default: 100 } as const;

export function markerScale(marker: { size?: number }): number {
	return (marker.size ?? MARKER_SIZE.default) / 100;
}

export type Storm = {
	id: string;
	kind: "storm";
	x: number;
	y: number;
	name: string;
	pressure: number;
	type: StormTypeId | null;
	note: string;
	labelPos: LabelPos;
};

/** One position of a track: where the centre is and how deep the low is there. */
export type TrackPoint = {
	x: number;
	y: number;
	/** Central pressure in hPa; decides the colour of the dot and of the line leaving it. */
	pressure: number;
	/** Optional text next to the dot, e.g. a time such as "Τρ 12Z". */
	label: string;
};

/** The path of a low: positions joined by a smooth line, coloured by pressure. */
export type Track = {
	id: string;
	kind: "track";
	name: string;
	points: TrackPoint[];
	/** Write the pressure under each dot. */
	showPressure?: boolean;
};

export type MapElement = Area | XMarker | Storm | Track;

export type MapData = {
	v: 1;
	areas: Area[];
	markers: XMarker[];
	storms: Storm[];
	tracks: Track[];
};

export const EMPTY_MAP_DATA: MapData = { v: 1, areas: [], markers: [], storms: [], tracks: [] };

export const LIMITS = {
	areas: 40,
	markers: 30,
	storms: 20,
	tracks: 10,
	trackPoints: 40,
	polygonPoints: 60,
} as const;

/** A pressure that stands for each class, used by the quick colour buttons. */
export const CLASS_QUICK_PRESSURE: Record<PressureClassId, number> = {
	low: 1008,
	significant: 995,
	deep: 982,
	"very-deep": 965,
};

/** Colour of the track at a given pressure (the class colour; grey outside the classes). */
export function pressureColor(hpa: number): string {
	return pressureClass(hpa)?.color ?? "#8a96a3";
}

export const DEFAULT_TITLE = "2026–2027 Named Storm Development Chances";

/** Corner of the map where the legend sits: top/bottom + left/right. */
export type LegendPosition = "tr" | "tl" | "br" | "bl";

export const LEGEND_POSITIONS: { id: LegendPosition; label: string }[] = [
	{ id: "tr", label: "Πάνω δεξιά" },
	{ id: "tl", label: "Πάνω αριστερά" },
	{ id: "br", label: "Κάτω δεξιά" },
	{ id: "bl", label: "Κάτω αριστερά" },
];

export const UNOFFICIAL_NOTE =
	"Ανεπίσημη εκτίμηση του GreeceWeather.gr. Δεν αποτελεί επίσημη πρόγνωση ή προειδοποίηση. " +
	"Για επίσημες προειδοποιήσεις ανατρέξτε στον επίσημο εθνικό μετεωρολογικό φορέα της χώρας";
