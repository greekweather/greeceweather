import { clampToMap, type Pt } from "@/lib/outlook/geo";
import {
	type Area,
	type EllipseArea,
	type MapData,
	type MapElement,
	pressureClass,
	type Storm,
	stormType,
	type XMarker,
} from "@/lib/outlook/types";

// Pure helpers used by the editor (and tested without a browser).

export function newId(): string {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return crypto.randomUUID();
	}
	return `id-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function allElements(data: MapData): MapElement[] {
	return [...data.areas, ...data.markers, ...data.storms];
}

export function findElement(data: MapData, id: string | null): MapElement | null {
	if (!id) return null;
	return allElements(data).find((el) => el.id === id) ?? null;
}

export function addElement(data: MapData, el: MapElement): MapData {
	if (el.kind === "area") return { ...data, areas: [...data.areas, el] };
	if (el.kind === "x") return { ...data, markers: [...data.markers, el] };
	return { ...data, storms: [...data.storms, el] };
}

export function replaceElement(data: MapData, next: MapElement): MapData {
	if (next.kind === "area") {
		return { ...data, areas: data.areas.map((a) => (a.id === next.id ? next : a)) };
	}
	if (next.kind === "x") {
		return { ...data, markers: data.markers.map((m) => (m.id === next.id ? next : m)) };
	}
	return { ...data, storms: data.storms.map((s) => (s.id === next.id ? next : s)) };
}

export function removeElement(data: MapData, id: string): MapData {
	return {
		...data,
		areas: data.areas.filter((a) => a.id !== id),
		markers: data.markers.filter((m) => m.id !== id),
		storms: data.storms.filter((s) => s.id !== id),
	};
}

/** Moves an element by (dx, dy) map degrees. Centres and vertices stay on the map. */
export function translateElement<T extends MapElement>(el: T, dx: number, dy: number): T {
	if (el.kind === "area" && el.shape === "polygon") {
		return {
			...el,
			points: el.points.map((p): [number, number] => {
				const [x, y] = clampToMap(p[0] + dx, p[1] + dy);
				return [x, y];
			}),
		};
	}
	const [x, y] = clampToMap(el.x + dx, el.y + dy);
	return { ...el, x, y };
}

export function defaultEllipse(x: number, y: number): EllipseArea {
	return {
		id: newId(),
		kind: "area",
		shape: "ellipse",
		horizon: "48h",
		chance: 30,
		x,
		y,
		rx: 3,
		ry: 1.7,
		rot: 0,
	};
}

export function defaultMarker(x: number, y: number): XMarker {
	return { id: newId(), kind: "x", x, y, label: "" };
}

export function defaultStorm(x: number, y: number): Storm {
	return {
		id: newId(),
		kind: "storm",
		x,
		y,
		name: "",
		pressure: 995,
		type: null,
		note: "",
		labelPos: "right",
	};
}

/** A copy of the element, a little to the south-east, with a new id. */
export function duplicateElement(el: MapElement): MapElement {
	const copy = translateElement(el, 1.2, -0.9);
	return { ...copy, id: newId() };
}

export function areaCenter(area: Area): Pt {
	if (area.shape === "ellipse") return [area.x, area.y];
	const n = area.points.length;
	return [
		area.points.reduce((sum, p) => sum + p[0], 0) / n,
		area.points.reduce((sum, p) => sum + p[1], 0) / n,
	];
}

/** Short Greek description for the element list in the editor. */
export function describeElement(el: MapElement): string {
	if (el.kind === "area") {
		const when = el.horizon === "48h" ? "48 ώρες" : "7 ημέρες";
		const shape = el.shape === "ellipse" ? "Έλλειψη" : "Ελεύθερο σχήμα";
		return `${shape} · ${when} · ${el.chance}%`;
	}
	if (el.kind === "x") {
		return el.label ? `Διαταραχή (X) · ${el.label}` : "Διαταραχή (X)";
	}
	const cls = pressureClass(el.pressure);
	const type = stormType(el.type);
	const parts = [el.name || "Χωρίς όνομα", cls?.name ?? "—", `${el.pressure} hPa`];
	if (type) parts.push(type.name);
	return parts.join(" · ");
}
