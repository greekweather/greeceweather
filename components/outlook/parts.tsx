import { memo } from "react";
import { BORDERS_PATH, LAKES_PATH, LAND_PATH } from "@/lib/outlook/basemap";
import {
	LAT_MAX,
	LAT_MIN,
	LON_MAX,
	LON_MIN,
	MAP_H,
	MAP_W,
	mercY,
	SCALE,
	toUnits,
} from "@/lib/outlook/geo";
import { closedSplinePath, ellipsePathUnits, polygonCentroid } from "@/lib/outlook/shapes";
import {
	type Area,
	CHANCE_STYLE,
	type ChanceCategory,
	chanceCategory,
	markerScale,
	PLAIN_LOW_CODE,
	type PressureClass,
	pressureClass,
	type Storm,
	type StormType,
	stormType,
	type XMarker,
} from "@/lib/outlook/types";

export const FONT = "Arial, Helvetica, sans-serif";

const OCEAN = "#cfe4f2";
const LAND = "#f1eee4";
const COAST = "#6f7f8d";
const BORDER = "#9aa5af";

const HALO = {
	paintOrder: "stroke",
	stroke: "#ffffff",
	strokeLinejoin: "round",
} as const;

const LON_LINES = [-50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50, 60];
const LAT_LINES = [30, 40, 50, 60, 70, 80];

type MapLabel = {
	text: string;
	lon: number;
	lat: number;
	kind: "sea" | "country" | "island";
	size?: number;
	rot?: number;
};

const LABELS: MapLabel[] = [
	{ text: "ΑΤΛΑΝΤΙΚΟΣ ΩΚΕΑΝΟΣ", lon: -19, lat: 47.5, kind: "sea", size: 15, rot: -12 },
	{ text: "Μεσόγειος Θάλασσα", lon: 15.5, lat: 34.2, kind: "sea", size: 13 },
	{ text: "Αιγαίο", lon: 25.3, lat: 38.9, kind: "sea", size: 10 },
	{ text: "Ιόνιο", lon: 18.6, lat: 37.9, kind: "sea", size: 10 },
	{ text: "Αδριατική", lon: 15.2, lat: 42.7, kind: "sea", size: 9.5, rot: 38 },
	{ text: "Μαύρη Θάλασσα", lon: 34.3, lat: 43.3, kind: "sea", size: 12 },
	{ text: "Βόρεια Θάλασσα", lon: 3.2, lat: 56.3, kind: "sea", size: 11 },
	{ text: "Βαλτική", lon: 19.5, lat: 57.5, kind: "sea", size: 10 },
	{ text: "ΕΛΛΑΔΑ", lon: 22.1, lat: 39.5, kind: "country", size: 10.5 },
	{ text: "ΤΟΥΡΚΙΑ", lon: 33.5, lat: 38.9, kind: "country", size: 12 },
	{ text: "ΙΤΑΛΙΑ", lon: 12.4, lat: 43.2, kind: "country", size: 10.5, rot: 38 },
	{ text: "ΙΣΠΑΝΙΑ", lon: -3.6, lat: 40.2, kind: "country", size: 12 },
	{ text: "ΓΑΛΛΙΑ", lon: 2.4, lat: 46.9, kind: "country", size: 12 },
	{ text: "ΓΕΡΜΑΝΙΑ", lon: 10.2, lat: 51.2, kind: "country", size: 11 },
	{ text: "ΠΟΛΩΝΙΑ", lon: 19.6, lat: 52.2, kind: "country", size: 10.5 },
	{ text: "ΟΥΚΡΑΝΙΑ", lon: 31.2, lat: 49.2, kind: "country", size: 12 },
	{ text: "ΡΟΥΜΑΝΙΑ", lon: 24.9, lat: 45.8, kind: "country", size: 9.5 },
	{ text: "ΒΡΕΤΑΝΙΑ", lon: -2.6, lat: 54.1, kind: "country", size: 10.5 },
	{ text: "ΝΟΡΒΗΓΙΑ", lon: 9.4, lat: 61.1, kind: "country", size: 10.5 },
	{ text: "ΣΟΥΗΔΙΑ", lon: 16.4, lat: 60.6, kind: "country", size: 10.5 },
	{ text: "ΜΑΡΟΚΟ", lon: -6.6, lat: 31.8, kind: "country", size: 11 },
	{ text: "ΑΛΓΕΡΙΑ", lon: 3.4, lat: 31.9, kind: "country", size: 12 },
	{ text: "ΤΥΝΗΣΙΑ", lon: 9.3, lat: 34.2, kind: "country", size: 9 },
	{ text: "ΛΙΒΥΗ", lon: 17.5, lat: 28.4, kind: "country", size: 12 },
	{ text: "ΑΙΓΥΠΤΟΣ", lon: 29.8, lat: 27.1, kind: "country", size: 12 },
	{ text: "ΣΥΡΙΑ", lon: 38.3, lat: 35.2, kind: "country", size: 10 },
	{ text: "ΙΡΑΚ", lon: 43.5, lat: 33.4, kind: "country", size: 10 },
	{ text: "ΚΥΠΡΟΣ", lon: 33.1, lat: 34.9, kind: "island", size: 8 },
];

function MapLabels() {
	return (
		<g fontFamily={FONT} textAnchor="middle" pointerEvents="none">
			{LABELS.map((label) => {
				const [x, y] = toUnits(label.lon, mercY(label.lat));
				const sea = label.kind === "sea";
				return (
					<text
						key={label.text}
						x={x}
						y={y}
						fontSize={label.size ?? 11}
						fontStyle={sea ? "italic" : "normal"}
						fontWeight={sea ? 400 : 600}
						letterSpacing={sea ? 1.4 : 1.1}
						fill={sea ? "#5b86a8" : "#8b9096"}
						transform={label.rot ? `rotate(${label.rot} ${x} ${y})` : undefined}
						style={{
							paintOrder: "stroke",
							stroke: sea ? OCEAN : LAND,
							strokeWidth: 2.4,
							strokeLinejoin: "round",
						}}
					>
						{label.text}
					</text>
				);
			})}
		</g>
	);
}

function Graticule() {
	const edge = 5;

	return (
		<g pointerEvents="none">
			<g stroke="#6d8aa3" strokeWidth={0.6} strokeDasharray="2 3.5" opacity={0.65} fill="none">
				{LON_LINES.filter((lon) => lon > LON_MIN && lon < LON_MAX).map((lon) => {
					const x = (lon - LON_MIN) * SCALE;
					return <line key={`lon-${lon}`} x1={x} y1={0} x2={x} y2={MAP_H} />;
				})}
				{LAT_LINES.filter((lat) => lat > LAT_MIN && lat < LAT_MAX).map((lat) => {
					const y = toUnits(0, mercY(lat))[1];
					return <line key={`lat-${lat}`} x1={0} y1={y} x2={MAP_W} y2={y} />;
				})}
			</g>

			<g
				fontFamily={FONT}
				fontSize={10.5}
				fill="#34536f"
				fontWeight={600}
				style={HALO}
				strokeWidth={3}
			>
				{LON_LINES.filter((lon) => lon > LON_MIN && lon < LON_MAX).map((lon) => {
					const x = (lon - LON_MIN) * SCALE;
					const text = `${Math.abs(lon)}°${lon < 0 ? "Δ" : lon > 0 ? "Α" : ""}`;
					return (
						<text key={`lon-t-${lon}`} x={x} y={MAP_H - edge} textAnchor="middle">
							{text}
						</text>
					);
				})}
				{LAT_LINES.filter((lat) => lat > LAT_MIN && lat < LAT_MAX).map((lat) => {
					const y = toUnits(0, mercY(lat))[1];
					return (
						<text key={`lat-t-${lat}`} x={edge} y={y - 4}>
							{`${lat}°Β`}
						</text>
					);
				})}
			</g>
		</g>
	);
}

/** Sea, land, borders, graticule and place names. Never changes, so it is memoised. */
export const BaseMap = memo(function BaseMap() {
	return (
		<g>
			<rect width={MAP_W} height={MAP_H} fill={OCEAN} />
			<path
				d={LAND_PATH}
				fill={LAND}
				fillRule="evenodd"
				stroke={COAST}
				strokeWidth={0.7}
				strokeLinejoin="round"
			/>
			<path d={LAKES_PATH} fill={OCEAN} fillRule="evenodd" stroke={COAST} strokeWidth={0.5} />
			<path
				d={BORDERS_PATH}
				fill="none"
				stroke={BORDER}
				strokeWidth={0.55}
				strokeLinejoin="round"
			/>
			<Graticule />
			<MapLabels />
		</g>
	);
});

const CATEGORIES: ChanceCategory[] = ["none", "low", "medium", "high"];

export function hatchId(prefix: string, category: ChanceCategory) {
	return `${prefix}-hatch-${category}`;
}

/** Diagonal hatching used for the "within 7 days" areas. */
export function ChanceDefs({ prefix }: { prefix: string }) {
	return (
		<>
			{CATEGORIES.map((category) => {
				const style = CHANCE_STYLE[category];
				return (
					<pattern
						key={category}
						id={hatchId(prefix, category)}
						patternUnits="userSpaceOnUse"
						width={9}
						height={9}
						patternTransform="rotate(45)"
					>
						<rect width={9} height={9} fill={style.fill} fillOpacity={0.14} />
						<line
							x1={0}
							y1={0}
							x2={0}
							y2={9}
							stroke={style.fill}
							strokeWidth={4}
							strokeOpacity={0.95}
						/>
					</pattern>
				);
			})}
		</>
	);
}

export function areaPath(area: Area): string {
	if (area.shape === "ellipse") {
		const [cx, cy] = toUnits(area.x, area.y);
		return ellipsePathUnits(cx, cy, area.rx * SCALE, area.ry * SCALE, -area.rot);
	}
	return closedSplinePath(area.points, (p) => toUnits(p[0], p[1]));
}

function areaCenterUnits(area: Area): readonly [number, number] {
	return area.shape === "ellipse"
		? toUnits(area.x, area.y)
		: toUnits(...polygonCentroid(area.points));
}

function AreaShape({ area, prefix }: { area: Area; prefix: string }) {
	const category = chanceCategory(area.chance);
	const style = CHANCE_STYLE[category];
	const [cx, cy] = areaCenterUnits(area);
	const solid = area.horizon === "48h";

	return (
		<g data-oid={area.id}>
			<path
				d={areaPath(area)}
				fill={solid ? style.fill : `url(#${hatchId(prefix, category)})`}
				fillOpacity={solid ? 0.62 : 1}
				stroke={style.stroke}
				strokeWidth={2.2}
				strokeLinejoin="round"
				style={{ pointerEvents: "all" }}
			/>
			<text
				x={cx}
				y={cy}
				textAnchor="middle"
				dominantBaseline="central"
				fontFamily={FONT}
				fontSize={17}
				fontWeight={700}
				fill="#111"
				style={HALO}
				strokeWidth={3.4}
				pointerEvents="none"
			>
				{`${area.chance}%`}
			</text>
		</g>
	);
}

/** 7-day areas first (hatched), 48-hour areas on top, higher chances above lower ones. */
export function AreasLayer({ areas, prefix }: { areas: Area[]; prefix: string }) {
	const ordered = [...areas].sort((a, b) => {
		if (a.horizon !== b.horizon) return a.horizon === "7d" ? -1 : 1;
		return a.chance - b.chance;
	});

	return (
		<g>
			{ordered.map((area) => (
				<AreaShape key={area.id} area={area} prefix={prefix} />
			))}
		</g>
	);
}

export function XGlyph({ size = 8.5, chance = null }: { size?: number; chance?: number | null }) {
	const d = `M${-size} ${-size}L${size} ${size}M${-size} ${size}L${size} ${-size}`;

	// plain black X, or an X coloured by chance (gray for "near 0%") like the NHC's
	if (chance === null || chance === undefined) {
		return (
			<g strokeLinecap="round" pointerEvents="none">
				<path d={d} stroke="#fff" strokeWidth={7.5} />
				<path d={d} stroke="#111" strokeWidth={4} />
			</g>
		);
	}

	return (
		<g strokeLinecap="round" pointerEvents="none">
			<path d={d} stroke="#fff" strokeWidth={9.5} />
			<path d={d} stroke="#111" strokeWidth={7} />
			<path d={d} stroke={CHANCE_STYLE[chanceCategory(chance)].fill} strokeWidth={3.8} />
		</g>
	);
}

export function MarkersLayer({ markers }: { markers: XMarker[] }) {
	return (
		<g>
			{markers.map((marker) => {
				const [x, y] = toUnits(marker.x, marker.y);
				const scale = markerScale(marker);
				return (
					<g key={marker.id} data-oid={marker.id} transform={`translate(${x} ${y})`}>
						<circle r={14 * scale} fill="transparent" style={{ pointerEvents: "all" }} />
						<g transform={`scale(${scale})`}>
							<XGlyph chance={marker.chance ?? null} />
						</g>
						{marker.label && (
							<text
								y={8.5 * scale + 15.5}
								textAnchor="middle"
								fontFamily={FONT}
								fontSize={12}
								fontWeight={700}
								fill="#111"
								style={HALO}
								strokeWidth={3.2}
								pointerEvents="none"
							>
								{marker.label}
							</text>
						)}
					</g>
				);
			})}
		</g>
	);
}

const RING_RADII = [13.5, 17.5, 21.5, 25.5];
const DISC_R = 9.5;

function polar(angleDeg: number, radius: number): [number, number] {
	const a = (angleDeg * Math.PI) / 180;
	return [radius * Math.cos(a), radius * Math.sin(a)];
}

/** One spiral arm leaving the outer ring, curling clockwise like the swirl of a cyclone. */
function armPath(startDeg: number, from: number): string {
	const steps = 14;
	const points: string[] = [];

	for (let i = 0; i <= steps; i++) {
		const t = i / steps;
		const [x, y] = polar(startDeg + t * 100, from + t * 10);
		points.push(`${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`);
	}

	return points.join("");
}

export function symbolRadius(cls: PressureClass, type: StormType | null): number {
	const outer = RING_RADII[cls.rings - 1];
	return outer + (type && type.family !== "extratropical" ? 11 : 2);
}

/**
 * Storm symbol, centred on (0, 0).
 *  - rings (1 to 4)  = pressure class, like closed isobars getting tighter
 *  - colour          = pressure class
 *  - spiral arms     = tropical / medicane (two arms), subtropical (one arm)
 *  - dashed rings    = extratropical
 *  - half-dashed     = subtropical
 *  - letters         = TD, TS, H, M, ET, SD, SS - or L for a plain low
 */
export function StormSymbol({ cls, type }: { cls: PressureClass; type: StormType | null }) {
	const family = type?.family ?? "plain";
	const radii = RING_RADII.slice(0, cls.rings);
	const outer = radii[radii.length - 1];
	const code = type?.code ?? PLAIN_LOW_CODE;
	const arms =
		family === "tropical" || family === "medicane"
			? [-90, 90]
			: family === "subtropical"
				? [-90]
				: [];

	return (
		<g pointerEvents="none">
			<circle r={outer + 2.2} fill="#fff" fillOpacity={0.78} />

			{arms.map((start) => (
				<g key={start} fill="none" strokeLinecap="round" strokeLinejoin="round">
					<path d={armPath(start, outer)} stroke="#fff" strokeWidth={6.6} />
					<path d={armPath(start, outer)} stroke={cls.color} strokeWidth={3.4} />
				</g>
			))}

			{radii.map((r) =>
				family === "subtropical" ? (
					<g key={r} fill="none" stroke={cls.color} strokeWidth={1.7}>
						<path d={`M${-r} 0A${r} ${r} 0 0 1 ${r} 0`} />
						<path d={`M${r} 0A${r} ${r} 0 0 1 ${-r} 0`} strokeDasharray="3.4 2.6" />
					</g>
				) : (
					<circle
						key={r}
						r={r}
						fill="none"
						stroke={cls.color}
						strokeWidth={1.7}
						strokeDasharray={family === "extratropical" ? "3.6 2.6" : undefined}
					/>
				),
			)}

			<circle r={DISC_R} fill={cls.color} stroke="#fff" strokeWidth={1.6} />
			<text
				textAnchor="middle"
				dominantBaseline="central"
				fontFamily={FONT}
				fontWeight={700}
				fontSize={code.length > 1 ? 10.5 : 13.5}
				fill="#fff"
			>
				{code}
			</text>
		</g>
	);
}

const LINE_H = 14;

function StormLabel({
	storm,
	cls,
	type,
}: {
	storm: Storm;
	cls: PressureClass;
	type: StormType | null;
}) {
	const lines: { text: string; weight: number; size: number; style?: "italic" }[] = [];

	if (storm.name) {
		lines.push({ text: storm.name.toLocaleUpperCase("el-GR"), weight: 700, size: 14.5 });
	}
	lines.push({ text: `${cls.name} · ${storm.pressure} hPa`, weight: 700, size: 11.5 });
	if (type) lines.push({ text: type.name, weight: 400, size: 11.5 });
	if (storm.note) lines.push({ text: storm.note, weight: 400, size: 10.5, style: "italic" });

	const off = symbolRadius(cls, type) + 6;
	const n = lines.length;
	const side = storm.labelPos;

	let x = 0;
	let anchor: "start" | "end" | "middle" = "middle";
	let y0 = 0;

	if (side === "right") {
		x = off;
		anchor = "start";
		y0 = -((n - 1) * LINE_H) / 2 + 4;
	} else if (side === "left") {
		x = -off;
		anchor = "end";
		y0 = -((n - 1) * LINE_H) / 2 + 4;
	} else if (side === "top") {
		y0 = -off - (n - 1) * LINE_H;
	} else {
		y0 = off + 10;
	}

	return (
		<g
			fontFamily={FONT}
			textAnchor={anchor}
			fill="#101820"
			style={HALO}
			strokeWidth={3.4}
			pointerEvents="none"
		>
			{lines.map((line, i) => (
				<text
					key={line.text}
					x={x}
					y={y0 + i * LINE_H}
					fontSize={line.size}
					fontWeight={line.weight}
					fontStyle={line.style}
				>
					{line.text}
				</text>
			))}
		</g>
	);
}

export function StormsLayer({ storms }: { storms: Storm[] }) {
	return (
		<g>
			{storms.map((storm) => {
				const cls = pressureClass(storm.pressure);
				if (!cls) return null;
				const type = stormType(storm.type);
				const [x, y] = toUnits(storm.x, storm.y);

				return (
					<g key={storm.id} data-oid={storm.id} transform={`translate(${x} ${y})`}>
						<circle
							r={symbolRadius(cls, type)}
							fill="transparent"
							style={{ pointerEvents: "all" }}
						/>
						<StormSymbol cls={cls} type={type} />
						<StormLabel storm={storm} cls={cls} type={type} />
					</g>
				);
			})}
		</g>
	);
}
