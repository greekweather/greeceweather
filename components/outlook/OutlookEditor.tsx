"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ElementPanel } from "@/components/outlook/ElementPanel";
import {
	AreasLayer,
	areaPath,
	BaseMap,
	ChanceDefs,
	MarkersLayer,
	StormsLayer,
	symbolRadius,
} from "@/components/outlook/parts";
import {
	addElement,
	allElements,
	defaultEllipse,
	defaultMarker,
	defaultStorm,
	describeElement,
	duplicateElement,
	findElement,
	newId,
	removeElement,
	replaceElement,
	translateElement,
} from "@/lib/outlook/edit";
import {
	clampToMap,
	formatLonLat,
	fromUnits,
	MAP_H,
	MAP_W,
	mapToLonLat,
	type Pt,
	round3,
	SCALE,
	toUnits,
} from "@/lib/outlook/geo";
import {
	closedSplinePath,
	ellipseFromAxis,
	ellipseHandle,
	normalizeAngle,
} from "@/lib/outlook/shapes";
import {
	type EllipseArea,
	LIMITS,
	type MapData,
	type MapElement,
	markerScale,
	type PolygonArea,
	pressureClass,
	stormType,
} from "@/lib/outlook/types";

type Tool = "select" | "ellipse" | "polygon" | "x" | "storm" | "pan";

type View = { x: number; y: number; w: number };

type Gesture =
	| { kind: "pan"; startX: number; startY: number; view: View }
	| { kind: "ellipse"; a: Pt }
	| { kind: "move"; id: string; start: Pt; base: MapData; orig: MapElement; moved: boolean }
	| { kind: "handle"; id: string; handle: string; index: number; base: MapData; moved: boolean }
	| { kind: "pinch"; dist: number; view: View; anchor: Pt };

const MIN_VIEW_W = MAP_W / 14;
const MAX_HISTORY = 60;
const HANDLE_PX = 7;

const TOOLS: { id: Tool; label: string; key: string; hint: string }[] = [
	{
		id: "select",
		label: "Επιλογή",
		key: "V",
		hint: "Πάτα ένα σχήμα για να το επιλέξεις και σύρε το για να το μετακινήσεις. Σύρε το κενό για να μετακινήσεις τον χάρτη.",
	},
	{
		id: "ellipse",
		label: "Έλλειψη",
		key: "E",
		hint: "Σύρε κατά μήκος του συστήματος, από το ένα άκρο στο άλλο. Μετά ρύθμισε το πλάτος από τις λαβές. Ένα απλό κλικ βάζει έτοιμη έλλειψη.",
	},
	{
		id: "polygon",
		label: "Ελεύθερο σχήμα",
		key: "P",
		hint: "Πάτα για να βάλεις κορυφές. Κλείσε το σχήμα με διπλό κλικ, με κλικ στην πρώτη κορυφή ή με Enter. Backspace σβήνει την τελευταία κορυφή, Esc ακυρώνει.",
	},
	{
		id: "x",
		label: "Διαταραχή (X)",
		key: "X",
		hint: "Πάτα στον χάρτη για να βάλεις X στη θέση μιας υφιστάμενης διαταραχής.",
	},
	{
		id: "storm",
		label: "Καταιγίδα",
		key: "L",
		hint: "Πάτα στον χάρτη για να βάλεις σύμβολο καταιγίδας ή χαμηλού. Τα στοιχεία του (όνομα, hPa, τύπος) ορίζονται δίπλα.",
	},
	{
		id: "pan",
		label: "Μετακίνηση",
		key: "H",
		hint: "Σύρε για να μετακινήσεις τον χάρτη. Ctrl + ροδέλα (ή τσίμπημα στο κινητό) για ζουμ.",
	},
];

function ToolIcon({ tool }: { tool: Tool }) {
	const common = {
		width: 18,
		height: 18,
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: 2,
		strokeLinecap: "round" as const,
		strokeLinejoin: "round" as const,
		"aria-hidden": true,
	};

	switch (tool) {
		case "select":
			return (
				<svg {...common} aria-hidden="true">
					<path d="M5 3l14 8-6 2-2 6z" />
				</svg>
			);
		case "ellipse":
			return (
				<svg {...common} aria-hidden="true">
					<ellipse cx="12" cy="12" rx="9.5" ry="5" transform="rotate(-25 12 12)" />
				</svg>
			);
		case "polygon":
			return (
				<svg {...common} aria-hidden="true">
					<path d="M4 15c-1-5 3-10 8-10s9 3 7 8-6 6-9 6-5-1-6-4z" />
				</svg>
			);
		case "x":
			return (
				<svg {...common} strokeWidth={3} aria-hidden="true">
					<path d="M6 6l12 12M18 6L6 18" />
				</svg>
			);
		case "storm":
			return (
				<svg {...common} aria-hidden="true">
					<circle cx="12" cy="12" r="3" />
					<circle cx="12" cy="12" r="6.5" />
					<path d="M12 5.5A6.5 6.5 0 0 1 18.5 12" />
					<path d="M12 18.5A6.5 6.5 0 0 1 5.5 12" />
				</svg>
			);
		default:
			return (
				<svg {...common} aria-hidden="true">
					<path d="M8 11V6a1.5 1.5 0 0 1 3 0v5m0-1V4.5a1.5 1.5 0 0 1 3 0V10m0-.5a1.5 1.5 0 0 1 3 0V14c0 4-2.5 7-6 7-2.5 0-4-1.5-5.5-4l-1.5-3a1.5 1.5 0 0 1 2.5-1.5L8 14" />
				</svg>
			);
	}
}

function clampView(v: View): View {
	const w = Math.min(MAP_W, Math.max(MIN_VIEW_W, v.w));
	const h = (w * MAP_H) / MAP_W;

	return {
		w,
		x: Math.max(0, Math.min(MAP_W - w, v.x)),
		y: Math.max(0, Math.min(Math.max(0, MAP_H - h), v.y)),
	};
}

function isTypingTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	return (
		target.isContentEditable ||
		target.closest("input, textarea, select") !== null ||
		(target.closest("button") !== null && target.closest("[data-editor-toolbar]") === null)
	);
}

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function OutlookEditor({
	value,
	onChange,
}: {
	value: MapData;
	onChange: (next: MapData) => void;
}) {
	const svgRef = useRef<SVGSVGElement>(null);
	const readoutRef = useRef<HTMLSpanElement>(null);
	const gesture = useRef<Gesture | null>(null);
	const pointers = useRef(new Map<number, [number, number]>());
	const spaceDown = useRef(false);
	const lastCoalesce = useRef<{ key: string; time: number } | null>(null);

	const [tool, setTool] = useState<Tool>("select");
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [view, setView] = useState<View>({ x: 0, y: 0, w: MAP_W });
	const [svgWidth, setSvgWidth] = useState(900);
	const [ellipseDraft, setEllipseDraft] = useState<{ a: Pt; b: Pt } | null>(null);
	const [polyDraft, setPolyDraft] = useState<Pt[]>([]);
	const [hover, setHover] = useState<Pt | null>(null);
	const [panning, setPanning] = useState(false);
	const [past, setPast] = useState<MapData[]>([]);
	const [future, setFuture] = useState<MapData[]>([]);
	const [notice, setNotice] = useState("");

	// Latest values for event handlers that run between renders.
	const valueRef = useRef(value);
	valueRef.current = value;
	const viewRef = useRef(view);
	viewRef.current = view;
	const selectedRef = useRef(selectedId);
	selectedRef.current = selectedId;

	const viewH = (view.w * MAP_H) / MAP_W;
	const upp = view.w / Math.max(svgWidth, 1); // map units per screen pixel
	const selected = findElement(value, selectedId);

	// ---- sizing ------------------------------------------------------------------

	useEffect(() => {
		const svg = svgRef.current;
		if (!svg || typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver(() => setSvgWidth(svg.getBoundingClientRect().width));
		observer.observe(svg);
		setSvgWidth(svg.getBoundingClientRect().width);
		return () => observer.disconnect();
	}, []);

	// ---- history -----------------------------------------------------------------

	const commit = useCallback(
		(next: MapData, base?: MapData, coalesceKey?: string) => {
			const now = Date.now();
			const last = lastCoalesce.current;

			if (coalesceKey && last && last.key === coalesceKey && now - last.time < 800) {
				lastCoalesce.current = { key: coalesceKey, time: now };
			} else {
				setPast((p) => [...p.slice(-(MAX_HISTORY - 1)), base ?? valueRef.current]);
				lastCoalesce.current = coalesceKey ? { key: coalesceKey, time: now } : null;
			}

			setFuture([]);
			onChange(next);
		},
		[onChange],
	);

	const undo = useCallback(() => {
		const previous = past[past.length - 1];
		if (!previous) return;
		setPast(past.slice(0, -1));
		setFuture((f) => [valueRef.current, ...f]);
		lastCoalesce.current = null;
		onChange(previous);
		if (selectedRef.current && !findElement(previous, selectedRef.current)) setSelectedId(null);
	}, [past, onChange]);

	const redo = useCallback(() => {
		const next = future[0];
		if (!next) return;
		setFuture(future.slice(1));
		setPast((p) => [...p, valueRef.current]);
		lastCoalesce.current = null;
		onChange(next);
	}, [future, onChange]);

	// ---- helpers -----------------------------------------------------------------

	function svgPoint(clientX: number, clientY: number): Pt {
		const svg = svgRef.current;
		const matrix = svg?.getScreenCTM();
		if (!svg || !matrix) return [0, 0];
		const inv = matrix.inverse();
		return [inv.a * clientX + inv.c * clientY + inv.e, inv.b * clientX + inv.d * clientY + inv.f];
	}

	function mapPoint(clientX: number, clientY: number): Pt {
		const [ux, uy] = svgPoint(clientX, clientY);
		const [x, y] = fromUnits(ux, uy);
		return clampToMap(x, y);
	}

	function changeTool(next: Tool) {
		setTool(next);
		setPolyDraft([]);
		setEllipseDraft(null);
		setHover(null);
		gesture.current = null;
		if (next !== "select") setSelectedId(null);
	}

	const changeToolRef = useRef(changeTool);
	changeToolRef.current = changeTool;

	function say(text: string) {
		setNotice(text);
	}

	function zoomAt(clientX: number, clientY: number, factor: number) {
		const current = viewRef.current;
		const [ux, uy] = svgPoint(clientX, clientY);
		const w = Math.min(MAP_W, Math.max(MIN_VIEW_W, current.w / factor));
		const h = (w * MAP_H) / MAP_W;
		const currentH = (current.w * MAP_H) / MAP_W;
		const fx = (ux - current.x) / current.w;
		const fy = (uy - current.y) / currentH;
		setView(clampView({ w, x: ux - fx * w, y: uy - fy * h }));
	}

	const zoomAtRef = useRef(zoomAt);
	zoomAtRef.current = zoomAt;

	function zoomCentre(factor: number) {
		const svg = svgRef.current;
		if (!svg) return;
		const rect = svg.getBoundingClientRect();
		zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
	}

	// ---- shapes ------------------------------------------------------------------

	function finishPolygon(points: Pt[]) {
		if (points.length < 3) {
			setPolyDraft([]);
			return;
		}

		if (valueRef.current.areas.length >= LIMITS.areas) {
			say(`Έως ${LIMITS.areas} περιοχές ανά χάρτη.`);
			setPolyDraft([]);
			return;
		}

		const area: PolygonArea = {
			id: newId(),
			kind: "area",
			shape: "polygon",
			horizon: "48h",
			chance: 30,
			points: points.map((p): [number, number] => [round3(p[0]), round3(p[1])]),
		};

		commit(addElement(valueRef.current, area));
		setPolyDraft([]);
		setHover(null);
		setSelectedId(area.id);
		setTool("select");
	}

	const finishPolygonRef = useRef(finishPolygon);
	finishPolygonRef.current = finishPolygon;

	function addAt(p: Pt, kind: "ellipse" | "x" | "storm") {
		const data = valueRef.current;

		if (kind === "ellipse") {
			if (data.areas.length >= LIMITS.areas) return say(`Έως ${LIMITS.areas} περιοχές ανά χάρτη.`);
			const el = defaultEllipse(round3(p[0]), round3(p[1]));
			commit(addElement(data, el));
			setSelectedId(el.id);
		} else if (kind === "x") {
			if (data.markers.length >= LIMITS.markers) return say(`Έως ${LIMITS.markers} σημεία X.`);
			const el = defaultMarker(round3(p[0]), round3(p[1]));
			commit(addElement(data, el));
			setSelectedId(el.id);
		} else {
			if (data.storms.length >= LIMITS.storms) return say(`Έως ${LIMITS.storms} καταιγίδες.`);
			const el = defaultStorm(round3(p[0]), round3(p[1]));
			commit(addElement(data, el));
			setSelectedId(el.id);
		}

		setTool("select");
	}

	function finishEllipse(a: Pt, b: Pt) {
		const data = valueRef.current;
		const length = dist(a, b) * SCALE;

		// a plain click: drop a ready-made ellipse
		if (length < 10 * upp) {
			addAt(a, "ellipse");
			return;
		}

		if (data.areas.length >= LIMITS.areas) return say(`Έως ${LIMITS.areas} περιοχές ανά χάρτη.`);

		const shape = ellipseFromAxis(a, b);
		const area: EllipseArea = {
			id: newId(),
			kind: "area",
			shape: "ellipse",
			horizon: "48h",
			chance: 30,
			x: round3(shape.x),
			y: round3(shape.y),
			rx: round3(Math.max(0.15, shape.rx)),
			ry: round3(Math.max(0.1, shape.ry)),
			rot: round3(shape.rot),
		};

		commit(addElement(data, area));
		setSelectedId(area.id);
		setTool("select");
	}

	function patchSelected(next: MapElement, coalesceKey?: string) {
		commit(replaceElement(valueRef.current, next), undefined, coalesceKey);
	}

	function deleteSelected() {
		const id = selectedRef.current;
		if (!id) return;
		commit(removeElement(valueRef.current, id));
		setSelectedId(null);
	}

	const deleteSelectedRef = useRef(deleteSelected);
	deleteSelectedRef.current = deleteSelected;

	function duplicateSelected() {
		const el = findElement(valueRef.current, selectedRef.current);
		if (!el) return;
		const copy = duplicateElement(el);
		commit(addElement(valueRef.current, copy));
		setSelectedId(copy.id);
	}

	// ---- pointer handling ----------------------------------------------------------

	function startPinch() {
		const pts = Array.from(pointers.current.values());
		if (pts.length < 2) return;
		const svg = svgRef.current;
		if (!svg) return;
		const cx = (pts[0][0] + pts[1][0]) / 2;
		const cy = (pts[0][1] + pts[1][1]) / 2;
		// a finger that was already drawing must not leave half a shape behind
		setEllipseDraft(null);
		gesture.current = {
			kind: "pinch",
			dist: Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]),
			view: viewRef.current,
			anchor: svgPoint(cx, cy),
		};
	}

	function onPointerDown(event: ReactPointerEvent<SVGSVGElement>) {
		if (event.pointerType === "mouse" && event.button !== 0 && event.button !== 1) return;

		event.preventDefault();
		if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
		pointers.current.set(event.pointerId, [event.clientX, event.clientY]);
		event.currentTarget.setPointerCapture(event.pointerId);

		if (pointers.current.size === 2) {
			startPinch();
			return;
		}

		if (pointers.current.size > 2) return;

		const target = event.target as Element;
		const p = mapPoint(event.clientX, event.clientY);

		if (event.button === 1 || tool === "pan" || spaceDown.current) {
			gesture.current = {
				kind: "pan",
				startX: event.clientX,
				startY: event.clientY,
				view: viewRef.current,
			};
			setPanning(true);
			return;
		}

		if (tool === "ellipse") {
			gesture.current = { kind: "ellipse", a: p };
			setEllipseDraft({ a: p, b: p });
			return;
		}

		if (tool === "polygon") {
			const first = polyDraft[0];
			if (polyDraft.length >= 3 && first && dist(p, first) * SCALE < HANDLE_PX * 1.6 * upp) {
				finishPolygon(polyDraft);
				return;
			}
			const last = polyDraft[polyDraft.length - 1];
			if (last && dist(p, last) * SCALE < 3 * upp) return; // second click of a double click
			if (polyDraft.length >= LIMITS.polygonPoints) return say("Πάρα πολλές κορυφές.");
			setPolyDraft([...polyDraft, p]);
			return;
		}

		if (tool === "x" || tool === "storm") {
			addAt(p, tool === "x" ? "x" : "storm");
			return;
		}

		// ---- select tool ----
		const handleEl = target.closest("[data-handle]");

		if (handleEl && selectedRef.current) {
			const handle = handleEl.getAttribute("data-handle") ?? "";
			const index = Number(handleEl.getAttribute("data-index") ?? 0);
			const base = valueRef.current;
			const el = findElement(base, selectedRef.current);

			if (handle === "mid" && el && el.kind === "area" && el.shape === "polygon") {
				// insert a vertex in the middle of the side and start dragging it
				const a = el.points[index];
				const b = el.points[(index + 1) % el.points.length];

				if (el.points.length >= LIMITS.polygonPoints) return say("Πάρα πολλές κορυφές.");

				const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
				const points = [...el.points.slice(0, index + 1), mid, ...el.points.slice(index + 1)];
				onChange(replaceElement(base, { ...el, points }));
				gesture.current = {
					kind: "handle",
					id: el.id,
					handle: "v",
					index: index + 1,
					base,
					moved: true,
				};
				return;
			}

			gesture.current = {
				kind: "handle",
				id: selectedRef.current,
				handle,
				index,
				base,
				moved: false,
			};
			return;
		}

		const elementEl = target.closest("[data-oid]");

		if (elementEl) {
			const id = elementEl.getAttribute("data-oid");
			const el = findElement(valueRef.current, id);

			if (id && el) {
				setSelectedId(id);
				gesture.current = {
					kind: "move",
					id,
					start: p,
					base: valueRef.current,
					orig: el,
					moved: false,
				};
				return;
			}
		}

		// empty space: deselect and pan
		setSelectedId(null);
		gesture.current = {
			kind: "pan",
			startX: event.clientX,
			startY: event.clientY,
			view: viewRef.current,
		};
		setPanning(true);
	}

	function onPointerMove(event: ReactPointerEvent<SVGSVGElement>) {
		if (pointers.current.has(event.pointerId)) {
			pointers.current.set(event.pointerId, [event.clientX, event.clientY]);
		}

		const p = mapPoint(event.clientX, event.clientY);

		if (readoutRef.current) {
			const { lon, lat } = mapToLonLat(p[0], p[1]);
			readoutRef.current.textContent = formatLonLat(lon, lat);
		}

		const g = gesture.current;

		if (!g) {
			if (tool === "polygon" && polyDraft.length > 0) setHover(p);
			return;
		}

		if (g.kind === "pinch") {
			const pts = Array.from(pointers.current.values());
			if (pts.length < 2) return;
			const svg = svgRef.current;
			if (!svg) return;
			const rect = svg.getBoundingClientRect();
			const d = Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]);
			const cx = (pts[0][0] + pts[1][0]) / 2;
			const cy = (pts[0][1] + pts[1][1]) / 2;
			const w = Math.min(MAP_W, Math.max(MIN_VIEW_W, (g.view.w * g.dist) / Math.max(d, 1)));
			const h = (w * MAP_H) / MAP_W;
			setView(
				clampView({
					w,
					x: g.anchor[0] - ((cx - rect.left) / rect.width) * w,
					y: g.anchor[1] - ((cy - rect.top) / rect.height) * h,
				}),
			);
			return;
		}

		if (g.kind === "pan") {
			const svg = svgRef.current;
			if (!svg) return;
			const unitsPerPx = g.view.w / svg.getBoundingClientRect().width;
			setView(
				clampView({
					w: g.view.w,
					x: g.view.x - (event.clientX - g.startX) * unitsPerPx,
					y: g.view.y - (event.clientY - g.startY) * unitsPerPx,
				}),
			);
			return;
		}

		if (g.kind === "ellipse") {
			setEllipseDraft({ a: g.a, b: p });
			return;
		}

		if (g.kind === "move") {
			const dx = p[0] - g.start[0];
			const dy = p[1] - g.start[1];
			if (!g.moved && Math.hypot(dx, dy) * SCALE < 3 * upp) return;
			g.moved = true;
			onChange(replaceElement(g.base, translateElement(g.orig, dx, dy)));
			return;
		}

		if (g.kind === "handle") {
			const el = findElement(g.base, g.id);
			if (el?.kind !== "area") return;
			g.moved = true;

			if (el.shape === "polygon") {
				const points = el.points.map((q, i): [number, number] =>
					i === g.index ? [p[0], p[1]] : q,
				);
				onChange(replaceElement(g.base, { ...el, points }));
				return;
			}

			if (g.handle === "maj+" || g.handle === "maj-") {
				const sign = g.handle === "maj+" ? 1 : -1;
				const vx = sign * (p[0] - el.x);
				const vy = sign * (p[1] - el.y);
				const rx = Math.min(60, Math.max(0.15, Math.hypot(vx, vy)));
				const rot = normalizeAngle((Math.atan2(vy, vx) * 180) / Math.PI);
				const ry = event.shiftKey ? el.ry * (rx / el.rx) : Math.min(el.ry, rx);
				onChange(
					replaceElement(g.base, {
						...el,
						rx: round3(rx),
						ry: round3(Math.max(0.1, ry)),
						rot: round3(rot),
					}),
				);
				return;
			}

			if (g.handle === "min+" || g.handle === "min-") {
				const r = (el.rot * Math.PI) / 180;
				const ux = -Math.sin(r);
				const uy = Math.cos(r);
				const ry = Math.abs((p[0] - el.x) * ux + (p[1] - el.y) * uy);
				onChange(
					replaceElement(g.base, { ...el, ry: round3(Math.min(el.rx, Math.max(0.1, ry))) }),
				);
			}
		}
	}

	function endGesture(event: ReactPointerEvent<SVGSVGElement>) {
		pointers.current.delete(event.pointerId);
		const g = gesture.current;

		if (g?.kind === "pinch") {
			if (pointers.current.size < 2) gesture.current = null;
			return;
		}

		gesture.current = null;
		setPanning(false);

		if (!g) return;

		if (g.kind === "ellipse") {
			const p = mapPoint(event.clientX, event.clientY);
			setEllipseDraft(null);
			if (event.type === "pointerup") finishEllipse(g.a, p);
			return;
		}

		if ((g.kind === "move" || g.kind === "handle") && g.moved) {
			if (event.type === "pointercancel") {
				onChange(g.base);
				return;
			}
			// the drag already updated the data; remember the state from before it
			setPast((p) => [...p.slice(-(MAX_HISTORY - 1)), g.base]);
			setFuture([]);
			lastCoalesce.current = null;
		}
	}

	function onDoubleClick(event: React.MouseEvent<SVGSVGElement>) {
		if (tool === "polygon" && polyDraft.length >= 3) {
			finishPolygon(polyDraft);
			return;
		}

		if (tool !== "select") return;

		const target = event.target as Element;
		const handleEl = target.closest("[data-handle]");
		const el = findElement(valueRef.current, selectedRef.current);

		// double click on a vertex removes it
		if (
			handleEl?.getAttribute("data-handle") === "v" &&
			el &&
			el.kind === "area" &&
			el.shape === "polygon" &&
			el.points.length > 3
		) {
			const index = Number(handleEl.getAttribute("data-index"));
			commit(
				replaceElement(valueRef.current, {
					...el,
					points: el.points.filter((_, i) => i !== index),
				}),
			);
		}
	}

	// ---- wheel (Ctrl + wheel zooms) and keyboard -------------------------------------

	useEffect(() => {
		const svg = svgRef.current;
		if (!svg) return;

		function onWheel(event: WheelEvent) {
			if (!event.ctrlKey && !event.metaKey) return;
			event.preventDefault();
			zoomAtRef.current(event.clientX, event.clientY, Math.exp(-event.deltaY * 0.0025));
		}

		svg.addEventListener("wheel", onWheel, { passive: false });
		return () => svg.removeEventListener("wheel", onWheel);
	}, []);

	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			if (isTypingTarget(event.target)) return;

			const mod = event.ctrlKey || event.metaKey;

			if (mod && event.key.toLowerCase() === "z") {
				event.preventDefault();
				if (event.shiftKey) redo();
				else undo();
				return;
			}

			if (mod && event.key.toLowerCase() === "y") {
				event.preventDefault();
				redo();
				return;
			}

			if (mod || event.altKey) return;

			if (event.key === " ") {
				if (!spaceDown.current) {
					spaceDown.current = true;
				}
				event.preventDefault();
				return;
			}

			if (event.key === "Escape") {
				setPolyDraft([]);
				setEllipseDraft(null);
				gesture.current = null;
				setTool("select");
				setSelectedId(null);
				return;
			}

			if (event.key === "Enter" && tool === "polygon") {
				finishPolygonRef.current(polyDraft);
				return;
			}

			if (event.key === "Backspace" || event.key === "Delete") {
				if (tool === "polygon" && polyDraft.length > 0) {
					event.preventDefault();
					setPolyDraft(polyDraft.slice(0, -1));
				} else if (selectedRef.current) {
					event.preventDefault();
					deleteSelectedRef.current();
				}
				return;
			}

			const shortcut = TOOLS.find((t) => t.key.toLowerCase() === event.key.toLowerCase());
			if (shortcut) changeToolRef.current(shortcut.id);
		}

		function onKeyUp(event: KeyboardEvent) {
			if (event.key === " ") spaceDown.current = false;
		}

		window.addEventListener("keydown", onKeyDown);
		window.addEventListener("keyup", onKeyUp);
		return () => {
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener("keyup", onKeyUp);
		};
	}, [tool, polyDraft, undo, redo]);

	// ---- overlay (selection, handles, drafts) ----------------------------------------

	const handleR = HANDLE_PX * upp;
	const stroke = "#1a5a96";

	function renderSelection() {
		if (!selected) return null;

		if (selected.kind === "area") {
			const outline = (
				<path
					d={areaPath(selected)}
					fill="none"
					stroke={stroke}
					strokeWidth={2}
					strokeDasharray="6 4"
					vectorEffect="non-scaling-stroke"
					pointerEvents="none"
				/>
			);

			if (selected.shape === "ellipse") {
				const [cx, cy] = toUnits(selected.x, selected.y);
				const handles: { id: string; kind: "major" | "minor"; sign: 1 | -1 }[] = [
					{ id: "maj+", kind: "major", sign: 1 },
					{ id: "maj-", kind: "major", sign: -1 },
					{ id: "min+", kind: "minor", sign: 1 },
					{ id: "min-", kind: "minor", sign: -1 },
				];

				return (
					<g>
						{outline}
						{handles.map((h) => {
							const [hx, hy] = toUnits(...ellipseHandle(selected, h.kind, h.sign));
							const major = h.kind === "major";
							return (
								<g key={h.id}>
									<line
										x1={cx}
										y1={cy}
										x2={hx}
										y2={hy}
										stroke={stroke}
										strokeWidth={1}
										strokeDasharray="2 3"
										vectorEffect="non-scaling-stroke"
										pointerEvents="none"
									/>
									{major ? (
										<circle
											data-handle={h.id}
											cx={hx}
											cy={hy}
											r={handleR}
											fill="#fff"
											stroke={stroke}
											strokeWidth={2.5}
											vectorEffect="non-scaling-stroke"
											style={{ cursor: "grab" }}
										/>
									) : (
										<rect
											data-handle={h.id}
											x={hx - handleR * 0.85}
											y={hy - handleR * 0.85}
											width={handleR * 1.7}
											height={handleR * 1.7}
											fill="#fff"
											stroke={stroke}
											strokeWidth={2.5}
											vectorEffect="non-scaling-stroke"
											transform={`rotate(${-selected.rot} ${hx} ${hy})`}
											style={{ cursor: "grab" }}
										/>
									)}
								</g>
							);
						})}
						<path
							d={`M${cx - handleR} ${cy}H${cx + handleR}M${cx} ${cy - handleR}V${cy + handleR}`}
							stroke={stroke}
							strokeWidth={2}
							vectorEffect="non-scaling-stroke"
							pointerEvents="none"
						/>
					</g>
				);
			}

			const pts = selected.points.map((p) => toUnits(p[0], p[1]));

			return (
				<g>
					{outline}
					{pts.map((p, i) => {
						const q = pts[(i + 1) % pts.length];
						return (
							<circle
								// biome-ignore lint/suspicious/noArrayIndexKey: vertices have no id
								key={`mid-${i}`}
								data-handle="mid"
								data-index={i}
								cx={(p[0] + q[0]) / 2}
								cy={(p[1] + q[1]) / 2}
								r={handleR * 0.6}
								fill="#fff"
								fillOpacity={0.8}
								stroke={stroke}
								strokeWidth={1.5}
								vectorEffect="non-scaling-stroke"
								style={{ cursor: "copy" }}
							/>
						);
					})}
					{pts.map((p, i) => (
						<circle
							// biome-ignore lint/suspicious/noArrayIndexKey: vertices have no id
							key={`v-${i}`}
							data-handle="v"
							data-index={i}
							cx={p[0]}
							cy={p[1]}
							r={handleR}
							fill="#fff"
							stroke={stroke}
							strokeWidth={2.5}
							vectorEffect="non-scaling-stroke"
							style={{ cursor: "grab" }}
						/>
					))}
				</g>
			);
		}

		const [x, y] = toUnits(selected.x, selected.y);
		let radius = selected.kind === "x" ? 18 * markerScale(selected) : 18;

		if (selected.kind === "storm") {
			const cls = pressureClass(selected.pressure);
			if (cls) radius = symbolRadius(cls, stormType(selected.type)) + 4;
		}

		return (
			<circle
				cx={x}
				cy={y}
				r={radius}
				fill="none"
				stroke={stroke}
				strokeWidth={2}
				strokeDasharray="5 4"
				vectorEffect="non-scaling-stroke"
				pointerEvents="none"
			/>
		);
	}

	function renderDrafts() {
		if (ellipseDraft) {
			const a = toUnits(...ellipseDraft.a);
			const b = toUnits(...ellipseDraft.b);
			const shape = ellipseFromAxis(ellipseDraft.a, ellipseDraft.b);
			const preview: EllipseArea = {
				id: "draft",
				kind: "area",
				shape: "ellipse",
				horizon: "48h",
				chance: 30,
				...shape,
			};
			const long = dist(ellipseDraft.a, ellipseDraft.b) * SCALE > 10 * upp;

			return (
				<g pointerEvents="none">
					{long && (
						<path
							d={areaPath(preview)}
							fill="#ffe600"
							fillOpacity={0.3}
							stroke="#b89b00"
							strokeWidth={2}
							strokeDasharray="6 4"
							vectorEffect="non-scaling-stroke"
						/>
					)}
					<line
						x1={a[0]}
						y1={a[1]}
						x2={b[0]}
						y2={b[1]}
						stroke={stroke}
						strokeWidth={1.5}
						vectorEffect="non-scaling-stroke"
					/>
					<circle cx={a[0]} cy={a[1]} r={handleR * 0.7} fill={stroke} />
					<circle cx={b[0]} cy={b[1]} r={handleR * 0.7} fill={stroke} />
				</g>
			);
		}

		if (polyDraft.length > 0) {
			const pts = polyDraft.map((p) => toUnits(p[0], p[1]));
			const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]} ${p[1]}`).join("");
			const rubber = hover ? toUnits(hover[0], hover[1]) : null;
			const preview =
				polyDraft.length >= 3 ? closedSplinePath(polyDraft, (p) => toUnits(p[0], p[1])) : "";

			return (
				<g pointerEvents="none">
					{preview && (
						<path
							d={preview}
							fill="#ffe600"
							fillOpacity={0.22}
							stroke="#b89b00"
							strokeWidth={1.5}
							strokeDasharray="5 4"
							vectorEffect="non-scaling-stroke"
						/>
					)}
					<path
						d={path}
						fill="none"
						stroke={stroke}
						strokeWidth={2}
						vectorEffect="non-scaling-stroke"
					/>
					{rubber && (
						<line
							x1={pts[pts.length - 1][0]}
							y1={pts[pts.length - 1][1]}
							x2={rubber[0]}
							y2={rubber[1]}
							stroke={stroke}
							strokeWidth={1.5}
							strokeDasharray="4 4"
							vectorEffect="non-scaling-stroke"
						/>
					)}
					{pts.map((p, i) => (
						<circle
							// biome-ignore lint/suspicious/noArrayIndexKey: vertices have no id
							key={`d-${i}`}
							cx={p[0]}
							cy={p[1]}
							r={i === 0 && pts.length >= 3 ? handleR * 1.1 : handleR * 0.7}
							fill={i === 0 ? "#fff" : stroke}
							stroke={stroke}
							strokeWidth={2}
							vectorEffect="non-scaling-stroke"
						/>
					))}
				</g>
			);
		}

		return null;
	}

	// ---- render ------------------------------------------------------------------

	const cursor =
		tool === "pan" || panning
			? panning
				? "grabbing"
				: "grab"
			: tool === "select"
				? "default"
				: "crosshair";

	const toolInfo = TOOLS.find((t) => t.id === tool);
	const elements = allElements(value);
	const zoomPercent = Math.round((MAP_W / view.w) * 100);

	return (
		<div className="outlook-editor">
			<div
				className="outlook-toolbar"
				data-editor-toolbar
				role="toolbar"
				aria-label="Εργαλεία χάρτη"
			>
				<div className="outlook-toolbar-group">
					{TOOLS.map((t) => (
						<button
							key={t.id}
							type="button"
							className={tool === t.id ? "active" : ""}
							aria-pressed={tool === t.id}
							title={`${t.label} (${t.key})`}
							onClick={() => changeTool(t.id)}
						>
							<ToolIcon tool={t.id} />
							<span>{t.label}</span>
						</button>
					))}
				</div>

				<div className="outlook-toolbar-group">
					<button
						type="button"
						onClick={undo}
						disabled={past.length === 0}
						title="Αναίρεση (Ctrl+Z)"
					>
						↶<span className="sr-only"> Αναίρεση</span>
					</button>
					<button
						type="button"
						onClick={redo}
						disabled={future.length === 0}
						title="Επανάληψη (Ctrl+Y)"
					>
						↷<span className="sr-only"> Επανάληψη</span>
					</button>
				</div>

				<div className="outlook-toolbar-group">
					<button
						type="button"
						onClick={() => zoomCentre(1 / 1.5)}
						title="Σμίκρυνση"
						disabled={view.w >= MAP_W}
					>
						−<span className="sr-only"> Σμίκρυνση</span>
					</button>
					<span className="outlook-zoom">{zoomPercent}%</span>
					<button
						type="button"
						onClick={() => zoomCentre(1.5)}
						title="Μεγέθυνση"
						disabled={view.w <= MIN_VIEW_W + 0.01}
					>
						+<span className="sr-only"> Μεγέθυνση</span>
					</button>
					<button
						type="button"
						onClick={() => setView({ x: 0, y: 0, w: MAP_W })}
						title="Όλος ο χάρτης"
					>
						⤢<span className="sr-only"> Όλος ο χάρτης</span>
					</button>
				</div>
			</div>

			<p className="outlook-tool-hint" aria-live="polite">
				{notice || toolInfo?.hint}
			</p>

			<div className="outlook-workspace">
				<div className="outlook-stage">
					<svg
						ref={svgRef}
						className="outlook-svg"
						viewBox={`${view.x} ${view.y} ${view.w} ${viewH}`}
						role="application"
						aria-label="Χάρτης σχεδίασης. Χρησιμοποίησε το ποντίκι ή την οθόνη αφής."
						style={{ cursor, touchAction: "none", userSelect: "none", WebkitUserSelect: "none" }}
						onPointerDown={onPointerDown}
						onPointerMove={onPointerMove}
						onPointerUp={endGesture}
						onPointerCancel={endGesture}
						onDoubleClick={onDoubleClick}
						onContextMenu={(event) => event.preventDefault()}
					>
						<title>Χάρτης σχεδίασης</title>
						<defs>
							<ChanceDefs prefix="ed" />
						</defs>
						<BaseMap />
						<AreasLayer areas={value.areas} prefix="ed" />
						<MarkersLayer markers={value.markers} />
						<StormsLayer storms={value.storms} />
						{renderSelection()}
						{renderDrafts()}
					</svg>

					<div className="outlook-readout">
						<span ref={readoutRef}>—</span>
						<span>Ctrl + ροδέλα: ζουμ · Space + σύρσιμο: μετακίνηση</span>
					</div>
				</div>

				<aside className="outlook-side">
					{selected ? (
						<ElementPanel
							key={selected.id}
							element={selected}
							onChange={patchSelected}
							onDelete={deleteSelected}
							onDuplicate={duplicateSelected}
						/>
					) : (
						<div className="outlook-panel">
							<h3>Στοιχεία χάρτη</h3>
							{elements.length === 0 ? (
								<p className="outlook-hint">
									Ο χάρτης είναι κενός. Διάλεξε ένα εργαλείο και ζωγράφισε στον χάρτη.
								</p>
							) : (
								<p className="outlook-hint">Πάτα ένα στοιχείο για να το επεξεργαστείς.</p>
							)}
						</div>
					)}

					{elements.length > 0 && (
						<ul className="outlook-list" aria-label="Λίστα στοιχείων">
							{elements.map((el) => (
								<li key={el.id}>
									<button
										type="button"
										className={el.id === selectedId ? "active" : ""}
										onClick={() => {
											setTool("select");
											setSelectedId(el.id);
										}}
									>
										{describeElement(el)}
									</button>
								</li>
							))}
						</ul>
					)}
				</aside>
			</div>
		</div>
	);
}
