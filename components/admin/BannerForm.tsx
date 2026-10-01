"use client";

import { useActionState } from "react";

type Banner = {
	id?: string;
	forecast_enabled: boolean;
	forecast_url: string | null;
	emergency_enabled: boolean;
	emergency_url: string | null;
	update_enabled: boolean;
	update_url: string | null;
};

type BannerFormState = {
	error?: string;
};

const initialState: BannerFormState = {};

export function BannerForm({
	action,
	banner,
	children,
}: {
	action: (prevState: BannerFormState, formData: FormData) => Promise<BannerFormState>;
	banner?: Banner;
	children?: React.ReactNode;
}) {
	const [state, formAction] = useActionState(action, initialState);

	return (
		<form action={formAction} className="form-card form-grid">
			{banner?.id && <input type="hidden" name="id" value={banner.id} />}

			<div className="banner-option">
				<label className="banner-option-label">
					<input
						name="forecast_enabled"
						type="checkbox"
						defaultChecked={banner?.forecast_enabled ?? false}
					/>
					<span>ΠΡΟΓΝΩΣΗ</span>
				</label>

				<input
					name="forecast_url"
					type="url"
					placeholder="https://..."
					defaultValue={banner?.forecast_url ?? ""}
				/>

				<small>Το link που θα ανοίγει όταν ο χρήστης πατά «ΠΡΟΓΝΩΣΗ».</small>
			</div>

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
