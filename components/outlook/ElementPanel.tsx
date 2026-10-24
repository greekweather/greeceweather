"use client";

import { NumberField, TextField } from "@/components/outlook/fields";
import { invMercY, mercY, round3 } from "@/lib/outlook/geo";
import { normalizeAngle } from "@/lib/outlook/shapes";
import {
	type Area,
	CHANCE_STYLE,
	chanceCategory,
	HORIZONS,
	LABEL_POSITIONS,
	type LabelPos,
	type MapElement,
	MAX_PRESSURE,
	MIN_PRESSURE,
	pressureClass,
	STORM_TYPES,
	type Storm,
	type StormTypeId,
	type XMarker,
} from "@/lib/outlook/types";

type Patch = (next: MapElement, coalesceKey?: string) => void;

function Position({
	x,
	y,
	onMove,
}: {
	x: number;
	y: number;
	onMove: (x: number, y: number) => void;
}) {
	return (
		<div className="outlook-field-pair">
			<NumberField
				label="Γεωγρ. πλάτος (°Β)"
				value={invMercY(y)}
				min={20}
				max={70}
				step={0.1}
				decimals={2}
				onCommit={(lat) => onMove(x, round3(mercY(lat)))}
			/>
			<NumberField
				label="Γεωγρ. μήκος (°)"
				value={x}
				min={-40}
				max={60}
				step={0.1}
				decimals={2}
				onCommit={(lon) => onMove(round3(lon), y)}
			/>
		</div>
	);
}

function AreaFields({ area, onChange }: { area: Area; onChange: Patch }) {
	const category = chanceCategory(area.chance);
	const style = CHANCE_STYLE[category];

	return (
		<>
			<div className="outlook-field">
				<span className="outlook-field-label">Χρονικός ορίζοντας</span>
				<div className="outlook-segment" role="group" aria-label="Χρονικός ορίζοντας">
					{HORIZONS.map((h) => (
						<button
							key={h.id}
							type="button"
							className={area.horizon === h.id ? "active" : ""}
							aria-pressed={area.horizon === h.id}
							onClick={() => onChange({ ...area, horizon: h.id })}
						>
							{h.label}
						</button>
					))}
				</div>
				<small>
					{area.horizon === "48h"
						? "Γεμάτη περιοχή στον χάρτη."
						: "Διαγραμμισμένη περιοχή στον χάρτη."}
				</small>
			</div>

			<div className="outlook-field">
				<label htmlFor="outlook-chance-range">
					Πιθανότητα ανάπτυξης:{" "}
					<span className="outlook-chip" style={{ background: style.fill, color: "#111" }}>
						{area.chance}% · {style.label} ({style.range})
					</span>
				</label>
				<input
					id="outlook-chance-range"
					type="range"
					min={0}
					max={100}
					step={10}
					value={area.chance}
					onChange={(event) =>
						onChange({ ...area, chance: Number(event.target.value) }, `chance-${area.id}`)
					}
				/>
			</div>

			<NumberField
				label="Ακριβής τιμή (%)"
				value={area.chance}
				min={0}
				max={100}
				step={5}
				onCommit={(chance) => onChange({ ...area, chance: Math.round(chance) }, `chance-${area.id}`)}
			/>

			{area.shape === "ellipse" ? (
				<>
					<div className="outlook-field">
						<label htmlFor="outlook-aspect">
							Πλάτος σχήματος ({Math.round((area.ry / area.rx) * 100)}% του μήκους)
						</label>
						<input
							id="outlook-aspect"
							type="range"
							min={0.15}
							max={1}
							step={0.05}
							value={Math.min(1, Math.max(0.15, area.ry / area.rx))}
							onChange={(event) =>
								onChange(
									{ ...area, ry: round3(area.rx * Number(event.target.value)) },
									`aspect-${area.id}`,
								)
							}
						/>
					</div>

					<NumberField
						label="Περιστροφή (° αριστερόστροφα από Ανατολή)"
						value={area.rot}
						min={-180}
						max={180}
						decimals={0}
						onCommit={(rot) => onChange({ ...area, rot: normalizeAngle(rot) }, `rot-${area.id}`)}
					/>

					<Position x={area.x} y={area.y} onMove={(x, y) => onChange({ ...area, x, y })} />
				</>
			) : (
				<p className="outlook-hint">
					Ελεύθερο σχήμα με {area.points.length} κορυφές. Σύρε τις κορυφές για να αλλάξεις το
					σχήμα· πάτα τα μικρά + στις πλευρές για να προσθέσεις κορυφή· διπλό κλικ σε κορυφή για
					να τη σβήσεις.
				</p>
			)}
		</>
	);
}

function MarkerFields({ marker, onChange }: { marker: XMarker; onChange: Patch }) {
	return (
		<>
			<TextField
				label="Ετικέτα (προαιρετικά)"
				value={marker.label}
				maxLength={30}
				placeholder="π.χ. Invest 91M"
				onChange={(label) => onChange({ ...marker, label }, `label-${marker.id}`)}
			/>
			<Position x={marker.x} y={marker.y} onMove={(x, y) => onChange({ ...marker, x, y })} />
		</>
	);
}

function StormFields({ storm, onChange }: { storm: Storm; onChange: Patch }) {
	const cls = pressureClass(storm.pressure);

	return (
		<>
			<TextField
				label="Όνομα καταιγίδας (προαιρετικά)"
				value={storm.name}
				maxLength={40}
				placeholder="π.χ. Ελένη"
				onChange={(name) => onChange({ ...storm, name }, `name-${storm.id}`)}
			/>

			<NumberField
				label="Κεντρική πίεση (hPa)"
				value={storm.pressure}
				min={MIN_PRESSURE}
				max={MAX_PRESSURE}
				suffix="hPa"
				onCommit={(pressure) =>
					onChange({ ...storm, pressure: Math.round(pressure) }, `pressure-${storm.id}`)
				}
			/>

			{cls && (
				<p className="outlook-hint">
					Κλάση:{" "}
					<span className="outlook-chip" style={{ background: cls.color, color: "#fff" }}>
						{cls.name}
					</span>{" "}
					({cls.range})
				</p>
			)}

			<div className="outlook-field">
				<label htmlFor="outlook-storm-type">Τύπος συστήματος</label>
				<select
					id="outlook-storm-type"
					value={storm.type ?? ""}
					onChange={(event) =>
						onChange({
							...storm,
							type: event.target.value === "" ? null : (event.target.value as StormTypeId),
						})
					}
				>
					<option value="">Απλό χαμηλό (χωρίς ειδικό τύπο)</option>
					{STORM_TYPES.map((type) => (
						<option key={type.id} value={type.id}>
							{type.code} · {type.name}
						</option>
					))}
				</select>
			</div>

			<TextField
				label="Σημείωση (π.χ. κίνηση)"
				value={storm.note}
				maxLength={80}
				placeholder="π.χ. Κίνηση ΑΝΑ 20 km/h"
				onChange={(note) => onChange({ ...storm, note }, `note-${storm.id}`)}
			/>

			<div className="outlook-field">
				<label htmlFor="outlook-storm-label-pos">Θέση κειμένου</label>
				<select
					id="outlook-storm-label-pos"
					value={storm.labelPos}
					onChange={(event) => onChange({ ...storm, labelPos: event.target.value as LabelPos })}
				>
					{LABEL_POSITIONS.map((pos) => (
						<option key={pos.id} value={pos.id}>
							{pos.label}
						</option>
					))}
				</select>
			</div>

			<Position x={storm.x} y={storm.y} onMove={(x, y) => onChange({ ...storm, x, y })} />
		</>
	);
}

export function ElementPanel({
	element,
	onChange,
	onDelete,
	onDuplicate,
}: {
	element: MapElement;
	onChange: Patch;
	onDelete: () => void;
	onDuplicate: () => void;
}) {
	const title =
		element.kind === "area"
			? element.shape === "ellipse"
				? "Έλλειψη"
				: "Ελεύθερο σχήμα"
			: element.kind === "x"
				? "Διαταραχή (X)"
				: "Καταιγίδα / χαμηλό";

	return (
		<div className="outlook-panel">
			<h3>{title}</h3>

			{element.kind === "area" && <AreaFields area={element} onChange={onChange} />}
			{element.kind === "x" && <MarkerFields marker={element} onChange={onChange} />}
			{element.kind === "storm" && <StormFields storm={element} onChange={onChange} />}

			<div className="outlook-panel-actions">
				<button type="button" className="button secondary" onClick={onDuplicate}>
					Αντίγραφο
				</button>
				<button type="button" className="button danger" onClick={onDelete}>
					Διαγραφή
				</button>
			</div>
		</div>
	);
}
