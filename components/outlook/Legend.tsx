import { FONT, hatchId, StormSymbol, XGlyph } from "@/components/outlook/parts";
import {
	CHANCE_STYLE,
	type ChanceCategory,
	type LegendPosition,
	PRESSURE_CLASSES,
	STORM_TYPES,
} from "@/lib/outlook/types";

const LEGEND_W = 296;
const LEGEND_H = 452;
const PAD = 12;

const CATEGORIES: ChanceCategory[] = ["low", "medium", "high", "none"];

function Rule({ y }: { y: number }) {
	return <line x1={PAD} y1={y} x2={LEGEND_W - PAD} y2={y} stroke="#c3ccd4" strokeWidth={1} />;
}

function Heading({ y, children }: { y: number; children: string }) {
	return (
		<text x={PAD} y={y} fontSize={11.5} fontWeight={700} letterSpacing={0.5} fill="#16324f">
			{children}
		</text>
	);
}

/** Legend box, drawn in the corner of the map (map units). */
export function Legend({
	prefix,
	position,
	mapW,
	mapH,
}: {
	prefix: string;
	position: LegendPosition;
	mapW: number;
	mapH: number;
}) {
	const x = position === "tl" || position === "bl" ? 12 : mapW - LEGEND_W - 12;
	const y = position === "tl" || position === "tr" ? 12 : mapH - LEGEND_H - 12;
	const solidX = 118;
	const hatchX = 200;
	const swatchW = 70;

	return (
		<g transform={`translate(${x} ${y})`} fontFamily={FONT} pointerEvents="none">
			<rect
				width={LEGEND_W}
				height={LEGEND_H}
				rx={4}
				fill="#ffffff"
				fillOpacity={0.94}
				stroke="#16324f"
				strokeWidth={1.2}
			/>
			<Heading y={22}>ΠΙΘΑΝΟΤΗΤΑ ΑΝΑΠΤΥΞΗΣ</Heading>
			<g fontSize={10} fill="#38485a" textAnchor="middle">
				<text x={solidX + swatchW / 2} y={40}>
					Εντός 48 ωρών
				</text>
				<text x={hatchX + swatchW / 2} y={40}>
					Εντός 7 ημερών
				</text>
			</g>

			{CATEGORIES.map((category, i) => {
				const style = CHANCE_STYLE[category];
				const rowY = 47 + i * 22;
				return (
					<g key={category}>
						<text x={PAD} y={rowY + 12} fontSize={11} fontWeight={700} fill="#16324f">
							{style.label}
						</text>
						<text x={PAD + 58} y={rowY + 12} fontSize={10} fill="#5b6773">
							{style.range}
						</text>
						<rect
							x={solidX}
							y={rowY}
							width={swatchW}
							height={16}
							fill={style.fill}
							fillOpacity={0.62}
							stroke={style.stroke}
							strokeWidth={1.6}
						/>
						<rect
							x={hatchX}
							y={rowY}
							width={swatchW}
							height={16}
							fill={`url(#${hatchId(prefix, category)})`}
							stroke={style.stroke}
							strokeWidth={1.6}
						/>
					</g>
				);
			})}

			<g transform="translate(0 32)">
				<g transform={`translate(${PAD + 9} ${121})`}>
					<XGlyph size={6.5} />
				</g>
				<text x={PAD + 28} y={125} fontSize={10.5} fill="#16324f">
					Θέση υφιστάμενης διαταραχής
				</text>
				<text x={PAD + 28} y={136} fontSize={9} fill="#5b6773">
					Χρώμα X = πιθανότητα 48 ωρών
				</text>

				<Rule y={142} />
				<Heading y={160}>ΣΥΣΤΗΜΑΤΑ ΧΑΜΗΛΗΣ ΠΙΕΣΗΣ</Heading>
				{PRESSURE_CLASSES.map((cls, i) => {
					const rowY = 168 + i * 31;
					return (
						<g key={cls.id}>
							<g transform={`translate(${PAD + 17} ${rowY + 15}) scale(0.56)`}>
								<StormSymbol cls={cls} type={null} />
							</g>
							<text x={PAD + 44} y={rowY + 13} fontSize={11.5} fontWeight={700} fill="#16324f">
								{cls.name}
							</text>
							<text x={PAD + 44} y={rowY + 27} fontSize={10.5} fill="#5b6773">
								{cls.range}
							</text>
						</g>
					);
				})}

				<Rule y={300} />
				<Heading y={318}>ΤΥΠΟΙ ΣΥΣΤΗΜΑΤΩΝ</Heading>
				{STORM_TYPES.map((type, i) => {
					const column = i < 4 ? 0 : 1;
					const row = i < 4 ? i : i - 4;
					const tx = PAD + column * 142;
					const ty = 334 + row * 16;
					return (
						<g key={type.id}>
							<text x={tx} y={ty} fontSize={10.5} fontWeight={700} fill="#16324f">
								{type.code}
							</text>
							<text x={tx + 22} y={ty} fontSize={10} fill="#38485a">
								{type.name}
							</text>
						</g>
					);
				})}

				<g fontSize={9} fill="#5b6773">
					<text x={PAD} y={402}>
						Δακτύλιοι = κλάση πίεσης · διακεκομμένοι = εξωτροπικό
					</text>
					<text x={PAD} y={413}>
						μισοί δακτύλιοι = υποτροπικό · σπείρες = τροπικό / medicane
					</text>
				</g>
			</g>
		</g>
	);
}
