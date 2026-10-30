"use client";

import { useActionState, useState } from "react";
import { PostSearchSelect } from "@/components/admin/PostSearchSelect";
import { utcToAthensLocal } from "@/lib/date";

type Banner = {
	id?: string;
	title?: string | null;
	forecast_enabled: boolean;
	forecast_url: string | null;
	emergency_enabled: boolean;
	emergency_url: string | null;
	update_enabled: boolean;
	update_url: string | null;
	starts_at?: string | null;
	ends_at?: string | null;
};

type BannerFormState = {
	error?: string;
};

const initialState: BannerFormState = {};

export type ForecastRow = {
	post_id: string;
	starts_at: string | null;
	ends_at: string | null;
};

type LocalRow = { post_id: string; starts_at: string; ends_at: string };

const EMPTY_ROW: LocalRow = { post_id: "", starts_at: "", ends_at: "" };

type PostOption = { id: string; title: string };

function ForecastPosts({ posts, initial }: { posts: PostOption[]; initial: ForecastRow[] }) {
	// rows hold Athens-local "YYYY-MM-DDTHH:mm" strings, exactly what the inputs submit
	const [rows, setRows] = useState<LocalRow[]>(
		initial.length > 0
			? initial.map((row) => ({
					post_id: row.post_id,
					starts_at: utcToAthensLocal(row.starts_at),
					ends_at: utcToAthensLocal(row.ends_at),
				}))
			: [EMPTY_ROW],
	);

	function update(index: number, patch: Partial<LocalRow>) {
		setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
	}

	return (
		<div className="banner-option">
			<span className="banner-option-label banner-schedule-title">
				ΠΡΟΓΝΩΣΗ <em>άρθρο που ανοίγει το κουμπί</em>
			</span>

			{rows.map((row, index) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: rows have no stable id
				<div className="banner-forecast-row" key={index}>
					<div className="banner-forecast-head">
						<strong>{index === 0 ? "Πρώτο άρθρο" : `Επόμενο άρθρο ${index}`}</strong>
						{rows.length > 1 && (
							<button
								type="button"
								className="button secondary"
								onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
							>
								Αφαίρεση
							</button>
						)}
					</div>

					<PostSearchSelect
						name="forecast_post_id"
						posts={posts}
						value={row.post_id}
						onChange={(id) => update(index, { post_id: id })}
					/>

					<div className="banner-schedule-grid">
						<label className="banner-schedule-field">
							<span>Εμφάνιση από</span>
							<input
								name="forecast_starts_at"
								type="datetime-local"
								value={row.starts_at}
								onChange={(event) => update(index, { starts_at: event.target.value })}
							/>
						</label>

						<label className="banner-schedule-field">
							<span>Λήξη</span>
							<input
								name="forecast_ends_at"
								type="datetime-local"
								value={row.ends_at}
								onChange={(event) => update(index, { ends_at: event.target.value })}
							/>
						</label>
					</div>
				</div>
			))}

			{rows.length < 4 && (
				<button
					type="button"
					className="button secondary banner-forecast-add"
					onClick={() => setRows((current) => [...current, EMPTY_ROW])}
				>
					+ Προσθήκη επόμενου άρθρου
				</button>
			)}

			<small>
				Όταν λήξει το πρώτο άρθρο, το επόμενο παίρνει τη θέση του αυτόματα (όταν φτάσει η ώρα
				εμφάνισής του). Αν κανένα άρθρο δεν είναι ενεργό, το κουμπί «ΠΡΟΓΝΩΣΗ» δεν εμφανίζεται.
				Κενή έναρξη: αμέσως. Κενή λήξη: χωρίς λήξη. Ώρα Ελλάδας.
			</small>
		</div>
	);
}

export function BannerForm({
	action,
	banner,
	posts,
	forecasts = [],
	children,
}: {
	posts: PostOption[];
	forecasts?: ForecastRow[];
	action: (prevState: BannerFormState, formData: FormData) => Promise<BannerFormState>;
	banner?: Banner;
	children?: React.ReactNode;
}) {
	const [state, formAction] = useActionState(action, initialState);

	return (
		<form id="banner-form" action={formAction} className="form-card form-grid">
			{banner?.id && <input type="hidden" name="id" value={banner.id} />}

			<div className="banner-option">
				<label className="banner-option-label" htmlFor="banner-title">
					<span>ΤΙΤΛΟΣ ΜΠΑΝΕΡ</span>
				</label>

				<input
					id="banner-title"
					name="title"
					type="text"
					maxLength={80}
					placeholder="Ισχυρή κακοκαιρία σε εξέλιξη"
					defaultValue={banner?.title ?? ""}
				/>

				<small>
					Ο τίτλος που φαίνεται πάνω από τα κουμπιά. Αν μείνει κενός, εμφανίζεται «Ισχυρή
					κακοκαιρία σε εξέλιξη».
				</small>
			</div>

			<ForecastPosts posts={posts} initial={forecasts} />

			<div className="banner-option">
				<label className="banner-option-label">
					<input
						name="emergency_enabled"
						type="checkbox"
						defaultChecked={banner?.emergency_enabled ?? false}
					/>
					<span>ΕΚΤΑΚΤΟ ΔΕΛΤΙΟ</span>
				</label>

				<input
					name="emergency_url"
					type="url"
					placeholder="https://..."
					defaultValue={banner?.emergency_url ?? ""}
				/>

				<small>Το link που θα ανοίγει όταν ο χρήστης πατά «ΕΚΤΑΚΤΟ ΔΕΛΤΙΟ».</small>
			</div>

			<div className="banner-option">
				<label className="banner-option-label">
					<input
						name="update_enabled"
						type="checkbox"
						defaultChecked={banner?.update_enabled ?? false}
					/>
					<span>ΕΠΙΚΑΙΡΟΠΟΙΗΣΗ ΔΕΛΤΙΟΥ</span>
				</label>

				<input
					name="update_url"
					type="url"
					placeholder="https://..."
					defaultValue={banner?.update_url ?? ""}
				/>

				<small>Το link που θα ανοίγει όταν ο χρήστης πατά «ΕΠΙΚΑΙΡΟΠΟΙΗΣΗ ΔΕΛΤΙΟΥ».</small>
			</div>

			<div className="banner-option">
				<span className="banner-option-label banner-schedule-title">
					ΧΡΟΝΙΚΟ ΠΑΡΑΘΥΡΟ <em>ώρα Ελλάδας</em>
				</span>

				<div className="banner-schedule-grid">
					<label className="banner-schedule-field">
						<span>Έναρξη</span>
						<input
							name="starts_at"
							type="datetime-local"
							defaultValue={utcToAthensLocal(banner?.starts_at)}
						/>
					</label>

					<label className="banner-schedule-field">
						<span>Λήξη</span>
						<input
							name="ends_at"
							type="datetime-local"
							defaultValue={utcToAthensLocal(banner?.ends_at)}
						/>
					</label>
				</div>

				<small>
					Κενή έναρξη: εμφανίζεται αμέσως. Κενή λήξη: δεν λήγει ποτέ. Αν πολλά μπάνερ είναι ενεργά
					ταυτόχρονα, εμφανίζεται το πιο πρόσφατα ενημερωμένο.
				</small>
			</div>

			{state.error && (
				<p className="form-warning" role="alert">
					{state.error}
				</p>
			)}

			<div className="form-actions">
				<button className="button" type="submit">
					Αποθήκευση
				</button>

				{children}

				<a className="button secondary" href="/admin/banner">
					Ακύρωση
				</a>
			</div>
		</form>
	);
}
