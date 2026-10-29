import type { Pt } from "@/lib/outlook/geo";
import type { EllipseArea } from "@/lib/outlook/types";

// Geometry helpers for the shapes drawn on the map. All maths is done in map
// degrees (see geo.ts), where the projection is conformal.

const DEG = Math.PI / 180;

/** Closed smooth curve through the points (Catmull-Rom converted to Bezier). */
export function closedSplinePath(points: readonly Pt[], toXY: (p: Pt) => Pt): string {
	const pts = points.map(toXY);
	const n = pts.length;

	if (n < 3) {
		return "";
	}

	const at = (i: number): Pt => pts[(i + n) % n];
	const f = (v: number) => Math.round(v * 100) / 100;
	let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;

	for (let i = 0; i < n; i++) {
		const p0 = at(i - 1);
		const p1 = at(i);
		const p2 = at(i + 1);
		const p3 = at(i + 2);
		const c1x = p1[0] + (p2[0] - p0[0]) / 6;
		const c1y = p1[1] + (p2[1] - p0[1]) / 6;
		const c2x = p2[0] - (p3[0] - p1[0]) / 6;
		const c2y = p2[1] - (p3[1] - p1[1]) / 6;
		d += `C${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(p2[0])} ${f(p2[1])}`;
	}

	return `${d}Z`;
}

/** Area-weighted centre of a polygon; falls back to the average for degenerate shapes. */
export function polygonCentroid(points: readonly Pt[]): Pt {
	let area = 0;
	let cx = 0;
	let cy = 0;

	for (let i = 0; i < points.length; i++) {
		const [x1, y1] = points[i];
		const [x2, y2] = points[(i + 1) % points.length];
		const cross = x1 * y2 - x2 * y1;
		area += cross;
		cx += (x1 + x2) * cross;
		cy += (y1 + y2) * cross;
	}

	if (Math.abs(area) < 1e-9) {
		const n = points.length || 1;
		return [points.reduce((s, p) => s + p[0], 0) / n, points.reduce((s, p) => s + p[1], 0) / n];
	}

	return [cx / (3 * area), cy / (3 * area)];
}

/**
 * Unit vectors of the long and the short axis, in map degrees (y points north).
 * rot is the angle of the long axis counter-clockwise from east.
 */
function ellipseAxes(rotDeg: number): { major: Pt; minor: Pt } {
	const r = rotDeg * DEG;
	return {
		major: [Math.cos(r), Math.sin(r)],
		minor: [-Math.sin(r), Math.cos(r)],
	};
}

/** Where an end of the long (kind "major") or short ("minor") axis is, in map degrees. */
export function ellipseHandle(e: EllipseArea, kind: "major" | "minor", sign: 1 | -1): Pt {
	const axes = ellipseAxes(e.rot);
	const [vx, vy] = kind === "major" ? axes.major : axes.minor;
	const len = kind === "major" ? e.rx : e.ry;
	return [e.x + sign * vx * len, e.y + sign * vy * len];
}

/**
 * SVG path for an ellipse, in SVG units. rotDeg is the SVG rotation, i.e. clockwise on screen
 * (that is -rot of the stored ellipse).
 */
export function ellipsePathUnits(cx: number, cy: number, rx: number, ry: number, rotDeg: number) {
	const r = rotDeg * DEG;
	const cos = Math.cos(r);
	const sin = Math.sin(r);
	const f = (v: number) => Math.round(v * 100) / 100;
	const end1: Pt = [cx + rx * cos, cy + rx * sin];
	const end2: Pt = [cx - rx * cos, cy - rx * sin];
	return (
		`M${f(end1[0])} ${f(end1[1])}` +
		`A${f(rx)} ${f(ry)} ${f(rotDeg)} 1 1 ${f(end2[0])} ${f(end2[1])}` +
		`A${f(rx)} ${f(ry)} ${f(rotDeg)} 1 1 ${f(end1[0])} ${f(end1[1])}Z`
	);
}

/** Builds an ellipse from a drag along its long axis (A to B). */
export function ellipseFromAxis(
	a: Pt,
	b: Pt,
	aspect = 0.55,
): { x: number; y: number; rx: number; ry: number; rot: number } {
	const dx = b[0] - a[0];
	const dy = b[1] - a[1];
	const rx = Math.hypot(dx, dy) / 2;
	const rot = (Math.atan2(dy, dx) * 180) / Math.PI;
	return {
		x: (a[0] + b[0]) / 2,
		y: (a[1] + b[1]) / 2,
		rx,
		ry: rx * aspect,
		rot: normalizeAngle(rot),
	};
}

export function normalizeAngle(deg: number): number {
	let v = deg % 360;
	if (v > 180) v -= 360;
	if (v <= -180) v += 360;
	return v;
}
