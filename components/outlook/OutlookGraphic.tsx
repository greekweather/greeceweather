import { Legend } from "@/components/outlook/Legend";
import {
	AreasLayer,
	BaseMap,
	ChanceDefs,
	FONT,
	MarkersLayer,
	StormsLayer,
} from "@/components/outlook/parts";
import { MAP_H, MAP_W } from "@/lib/outlook/geo";
import type { LegendPosition, MapData } from "@/lib/outlook/types";

export const HEADER_H = 88;
export const FOOTER_H = 54;
export const GRAPHIC_W = MAP_W;
export const GRAPHIC_H = HEADER_H + MAP_H + FOOTER_H;

const NAVY = "#16324f";

export const EMPTY_LINES = [
	"Δεν αναμένεται ονοματοδοτούμενη κακοκαιρία",
	"στις επόμενες 7 ημέρες",
] as const;

function EmptyNotice() {
	const w = 600;
	const h = 100;

	return (
		<g transform={`translate(${(MAP_W - w) / 2 - 150} ${(MAP_H - h) / 2 + 40})`}>
			<rect
				width={w}
				height={h}
				rx={6}
				fill="#ffffff"
				fillOpacity={0.95}
				stroke={NAVY}
				strokeWidth={2}
			/>
			{EMPTY_LINES.map((line, index) => (
				<text
					key={line}
					x={w / 2}
					y={h / 2 + (index === 0 ? -14 : 18)}
					textAnchor="middle"
					dominantBaseline="central"
					fontSize={index === 0 ? 24 : 22}
					fontWeight={700}
					fill={NAVY}
				>
					{line}
				</text>
			))}
		</g>
	);
}

export type GraphicProps = {
	title: string;
	data: MapData;
	/** Already formatted, e.g. "Σάβ 24 Οκτ 2026, 03:00 EEST". */
	issuedText: string;
	validText?: string;
	legendPosition?: LegendPosition;
	/** Unique per SVG on a page (the hatch patterns use it for their ids). */
	idPrefix: string;
};

/**
 * The finished graphic: title bar, map, legend, storms, disclaimer.
 * Pure SVG, so it renders on the server and can be exported as an image.
 */
export function OutlookGraphic({
	title,
	data,
	issuedText,
	validText,
	legendPosition = "tr",
	idPrefix,
}: GraphicProps) {
	const clipId = `${idPrefix}-clip`;
	const empty = data.areas.length + data.markers.length + data.storms.length === 0;

	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox={`0 0 ${GRAPHIC_W} ${GRAPHIC_H}`}
			width={GRAPHIC_W}
			height={GRAPHIC_H}
			role="img"
			aria-label={`${title}. Ανεπίσημος χάρτης του GreeceWeather.gr.`}
			fontFamily={FONT}
			style={{ display: "block", width: "100%", height: "auto" }}
		>
			<title>{title}</title>
			<defs>
				<ChanceDefs prefix={idPrefix} />
				<clipPath id={clipId}>
					<rect width={MAP_W} height={MAP_H} />
				</clipPath>
			</defs>

			<rect width={GRAPHIC_W} height={GRAPHIC_H} fill="#ffffff" />

			{/* title bar */}
			<g>
				<rect width={GRAPHIC_W} height={HEADER_H} fill="#ffffff" />
				<rect y={HEADER_H - 5} width={GRAPHIC_W} height={5} fill={NAVY} />
				<text x={22} y={24} fontSize={12} fontWeight={700} letterSpacing={1.6} fill="#5b6773">
					GREECEWEATHER.GR · ΧΑΡΤΕΣ ΚΑΙΡΟΥ
				</text>
				<text x={22} y={56} fontSize={30} fontWeight={700} fill={NAVY}>
					{title}
				</text>
				<text x={22} y={76} fontSize={12.5} fill="#38485a">
					Ευρώπη · Μεσόγειος · Βόρειος Ατλαντικός
				</text>

				<g transform={`translate(${GRAPHIC_W - 22} 0)`} textAnchor="end">
					<rect
						x={-150}
						y={12}
						width={150}
						height={24}
						rx={3}
						fill="#ffffff"
						stroke="#c4161c"
						strokeWidth={2}
					/>
					<text
						x={-75}
						y={29}
						textAnchor="middle"
						fontSize={13}
						fontWeight={700}
						letterSpacing={1.2}
						fill="#c4161c"
					>
						ΑΝΕΠΙΣΗΜΟ
					</text>
					<text y={55} fontSize={12} fill="#16324f" fontWeight={700}>
						{`Έκδοση: ${issuedText}`}
					</text>
					{validText && (
						<text y={72} fontSize={12} fill="#38485a">
							{`Ισχύει: ${validText}`}
						</text>
					)}
				</g>
			</g>

			{/* map */}
			<g transform={`translate(0 ${HEADER_H})`}>
				<g clipPath={`url(#${clipId})`}>
					<BaseMap />
					<AreasLayer areas={data.areas} prefix={idPrefix} />
					<MarkersLayer markers={data.markers} />
					<StormsLayer storms={data.storms} />
					<Legend prefix={idPrefix} position={legendPosition} mapW={MAP_W} mapH={MAP_H} />
					{empty && <EmptyNotice />}
				</g>
				<rect width={MAP_W} height={MAP_H} fill="none" stroke={NAVY} strokeWidth={1.5} />
			</g>

			{/* disclaimer */}
			<g transform={`translate(0 ${HEADER_H + MAP_H})`}>
				<rect width={GRAPHIC_W} height={FOOTER_H} fill="#eef2f6" />
				<text x={22} y={21} fontSize={12} fontWeight={700} fill="#c4161c">
					ΑΝΕΠΙΣΗΜΗ ΕΚΤΙΜΗΣΗ του GreeceWeather.gr — δεν αποτελεί επίσημη πρόγνωση ή προειδοποίηση.
				</text>
				<text x={22} y={39} fontSize={11.5} fill="#38485a">
					Για επίσημες προειδοποιήσεις ανατρέξτε στην ΕΜΥ (emy.gr) και στη Γενική Γραμματεία
					Πολιτικής Προστασίας.
				</text>
				<text x={GRAPHIC_W - 22} y={39} fontSize={10} fill="#7b8794" textAnchor="end">
					Βάση χάρτη: Natural Earth
				</text>
			</g>
		</svg>
	);
}
