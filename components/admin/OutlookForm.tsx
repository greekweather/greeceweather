"use client";

import { useActionState, useId, useMemo, useState } from "react";
import { OutlookEditor } from "@/components/outlook/OutlookEditor";
import { OutlookGraphic } from "@/components/outlook/OutlookGraphic";
import { athensLocalToUTC, utcToAthensLocal } from "@/lib/date";
import { formatOutlookDate } from "@/lib/outlook/format";
import {
	DEFAULT_TITLE,
	EMPTY_MAP_DATA,
	LEGEND_POSITIONS,
	type LegendPosition,
	type MapData,
	UNOFFICIAL_NOTE,
} from "@/lib/outlook/types";

type FormState = { error?: string };

export type OutlookFormValues = {
	id?: string;
	title: string;
	slug: string;
	summary: string;
	map_data: MapData;
	legend_position: LegendPosition;
	issued_at: string | null;
	valid_until: string | null;
	published: boolean;
};

const initialState: FormState = {};

function safeIso(local: string): string | null {
	if (!local) return null;
	try {
		return athensLocalToUTC(local);
	} catch {
		return null;
	}
}

export function OutlookForm({
	action,
	outlook,
	defaultIssuedLocal,
	children,
}: {
	action: (prev: FormState, formData: FormData) => Promise<FormState>;
	outlook?: OutlookFormValues;
	/** "YYYY-MM-DDTHH:mm" in Athens time, computed on the server so SSR and hydration agree. */
	defaultIssuedLocal: string;
	children?: React.ReactNode;
}) {
	const [state, formAction, pending] = useActionState(action, initialState);
	const previewId = useId().replace(/:/g, "");

	const [title, setTitle] = useState(outlook?.title ?? DEFAULT_TITLE);
	const [issued, setIssued] = useState(
		outlook?.issued_at ? utcToAthensLocal(outlook.issued_at) : defaultIssuedLocal,
	);
	// date + time, so two maps issued on the same day (e.g. every 12 hours) get different slugs
	const slugFor = (local: string) =>
		`outlook-${local.slice(0, 10)}-${local.slice(11, 16).replace(":", "")}`;
	const [slug, setSlug] = useState(outlook?.slug || slugFor(defaultIssuedLocal));
	const [slugTouched, setSlugTouched] = useState(Boolean(outlook?.slug));
	const [validUntil, setValidUntil] = useState(utcToAthensLocal(outlook?.valid_until));
	const [legend, setLegend] = useState<LegendPosition>(outlook?.legend_position ?? "tr");
	const [data, setData] = useState<MapData>(outlook?.map_data ?? EMPTY_MAP_DATA);
	const [summary, setSummary] = useState(outlook?.summary ?? "");
	const [showPreview, setShowPreview] = useState(false);

	const issuedIso = safeIso(issued);
	const validIso = safeIso(validUntil);
	const mapJson = useMemo(() => JSON.stringify(data), [data]);

	return (
		<form action={formAction} className="outlook-form">
			{outlook?.id && <input type="hidden" name="id" value={outlook.id} />}
			<input type="hidden" name="map_data" value={mapJson} />

			<div className="form-card outlook-notice" role="note">
				<strong>Ανεπίσημο προϊόν:</strong> {UNOFFICIAL_NOTE} Το πρόσημο «ΑΝΕΠΙΣΗΜΟ» και η σχετική
				δήλωση τυπώνονται αυτόματα πάνω στον χάρτη και δεν αφαιρούνται.
			</div>

			<section className="form-card form-grid">
				<div className="form-field">
					<label htmlFor="outlook-title">Τίτλος χάρτη</label>
					<input
						id="outlook-title"
						name="title"
						type="text"
						value={title}
						maxLength={140}
						required
						onChange={(event) => setTitle(event.target.value)}
					/>
				</div>

				<div className="form-field">
					<label htmlFor="outlook-slug">Slug (διεύθυνση σελίδας)</label>
					<input
						id="outlook-slug"
						name="slug"
						type="text"
						value={slug}
						maxLength={100}
						pattern="[a-z0-9]+(-[a-z0-9]+)*"
						required
						onChange={(event) => {
							setSlug(event.target.value);
							setSlugTouched(true);
						}}
					/>
					<small>Λατινικά πεζά, αριθμοί και παύλες. Θα είναι /outlooks/{slug || "…"}</small>
				</div>

				<div className="outlook-field-pair">
					<div className="form-field">
						<label htmlFor="outlook-issued">Έκδοση (ώρα Ελλάδας)</label>
						<input
							id="outlook-issued"
							name="issued_at"
							type="datetime-local"
							value={issued}
							required
							onChange={(event) => {
								setIssued(event.target.value);
								if (!slugTouched && event.target.value) {
									setSlug(slugFor(event.target.value));
								}
							}}
						/>
					</div>

					<div className="form-field">
						<label htmlFor="outlook-valid">Ισχύει έως (προαιρετικά)</label>
						<input
							id="outlook-valid"
							name="valid_until"
							type="datetime-local"
							value={validUntil}
							onChange={(event) => setValidUntil(event.target.value)}
						/>
					</div>
				</div>

				<div className="form-field">
					<label htmlFor="outlook-legend">Θέση υπομνήματος</label>
					<select
						id="outlook-legend"
						name="legend_position"
						value={legend}
						onChange={(event) => setLegend(event.target.value as LegendPosition)}
					>
						{LEGEND_POSITIONS.map((pos) => (
							<option key={pos.id} value={pos.id}>
								{pos.label}
							</option>
						))}
					</select>
					<small>Διάλεξε γωνία που δεν καλύπτει τις περιοχές που σχεδίασες.</small>
				</div>
			</section>

			<section className="form-card">
				<h2 className="outlook-section-title">Χάρτης</h2>
				<OutlookEditor value={data} onChange={setData} />
			</section>

			<section className="form-card form-grid">
				<div className="form-field">
					<label htmlFor="outlook-summary">Πρόγνωση (Markdown, προαιρετικά)</label>
					<textarea
						id="outlook-summary"
						name="summary"
						rows={9}
						maxLength={20000}
						value={summary}
						onChange={(event) => setSummary(event.target.value)}
					/>
				</div>

				<label className="outlook-checkbox">
					<input name="published" type="checkbox" defaultChecked={outlook?.published ?? false} />
					<span>Δημοσιευμένη (ορατή στο κοινό)</span>
				</label>
			</section>

			<section className="form-card">
				<div className="outlook-preview-head">
					<h2 className="outlook-section-title">Προεπισκόπηση τελικού χάρτη</h2>
					<button
						type="button"
						className="button secondary"
						onClick={() => setShowPreview((value) => !value)}
					>
						{showPreview ? "Απόκρυψη" : "Εμφάνιση"}
					</button>
				</div>

				{showPreview && (
					<div className="outlook-preview">
						<OutlookGraphic
							title={title || DEFAULT_TITLE}
							data={data}
							issuedText={issuedIso ? formatOutlookDate(issuedIso) : "—"}
							validText={validIso ? formatOutlookDate(validIso) : undefined}
							legendPosition={legend}
							idPrefix={`pv${previewId}`}
						/>
					</div>
				)}
			</section>

			{state.error && (
				<p className="form-warning" role="alert">
					{state.error}
				</p>
			)}

			<div className="form-actions">
				<button className="button" type="submit" disabled={pending}>
					{pending ? "Αποθήκευση…" : "Αποθήκευση"}
				</button>

				{children}

				<a className="button secondary" href="/admin/outlooks">
					Ακύρωση
				</a>
			</div>
		</form>
	);
}
