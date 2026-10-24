// Map geometry for the outlook graphic.
//
// Projection: Mercator. Everything that is drawn is stored in "map degrees":
//   x = longitude, y = Mercator-y expressed in degrees.
// In that space angles are preserved, so an ellipse stays a true ellipse on the map.
//
// The extent and SCALE MUST match scripts/build-outlook-basemap.py.

export const LON_MIN = -30;
export const LON_MAX = 50;
export const LAT_MIN = 25;
export const LAT_MAX = 62;

/** Map units (SVG user units) per map degree. */
export const SCALE = 15;

export function mercY(lat: number): number {
	const rad = (lat * Math.PI) / 180;
	return (Math.log(Math.tan(Math.PI / 4 + rad / 2)) * 180) / Math.PI;
}

export function invMercY(y: number): number {
	const rad = (y * Math.PI) / 180;
	return ((2 * Math.atan(Math.exp(rad)) - Math.PI / 2) * 180) / Math.PI;
}

export const Y_TOP = mercY(LAT_MAX);
export const Y_BOTTOM = mercY(LAT_MIN);

export const MAP_W = (LON_MAX - LON_MIN) * SCALE;
export const MAP_H = (Y_TOP - Y_BOTTOM) * SCALE;

export type Pt = readonly [number, number];

/** Map degrees -> SVG units. */
export function toUnits(x: number, y: number): Pt {
	return [(x - LON_MIN) * SCALE, (Y_TOP - y) * SCALE];
}

/** SVG units -> map degrees. */
export function fromUnits(ux: number, uy: number): Pt {
	return [ux / SCALE + LON_MIN, Y_TOP - uy / SCALE];
}

export function lonLatToMap(lon: number, lat: number): Pt {
	return [lon, mercY(lat)];
}

export function mapToLonLat(x: number, y: number): { lon: number; lat: number } {
	return { lon: x, lat: invMercY(y) };
}

/** Keeps a map-degree point inside the visible map (with a small margin). */
export function clampToMap(x: number, y: number, margin = 0): Pt {
	return [
		Math.min(LON_MAX - margin, Math.max(LON_MIN + margin, x)),
		Math.min(Y_TOP - margin, Math.max(Y_BOTTOM + margin, y)),
	];
}

export function round3(value: number): number {
	return Math.round(value * 1000) / 1000;
}

/** "37.9°Β  23.7°Α" - used for the cursor read-out in the editor. */
export function formatLonLat(lon: number, lat: number): string {
	const ns = lat >= 0 ? "Β" : "Ν";
	const ew = lon >= 0 ? "Α" : "Δ";
	return `${Math.abs(lat).toFixed(1)}°${ns}  ${Math.abs(lon).toFixed(1)}°${ew}`;
}
