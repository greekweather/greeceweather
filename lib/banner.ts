import { athensLocalToUTC } from "@/lib/date";

type Schedule = {
	starts_at: string | null;
	ends_at: string | null;
};

export function parseBannerSchedule(
	formData: FormData,
): { ok: true; value: Schedule } | { ok: false; error: string } {
	const rawStart = String(formData.get("starts_at") ?? "").trim();
	const rawEnd = String(formData.get("ends_at") ?? "").trim();

	let starts_at: string | null = null;
	let ends_at: string | null = null;

	try {
		starts_at = rawStart ? athensLocalToUTC(rawStart) : null;
		ends_at = rawEnd ? athensLocalToUTC(rawEnd) : null;
	} catch {
		return { ok: false, error: "Μη έγκυρη ημερομηνία." };
	}

	if (starts_at && ends_at && new Date(ends_at) <= new Date(starts_at)) {
		return { ok: false, error: "Η λήξη πρέπει να είναι μετά την έναρξη." };
	}

	return { ok: true, value: { starts_at, ends_at } };
}

type BannerStatus = "active" | "scheduled" | "expired" | "disabled";

export function getBannerStatus(banner: {
	forecast_enabled: boolean;
	emergency_enabled: boolean;
	update_enabled: boolean;
	starts_at: string | null;
	ends_at: string | null;
}): BannerStatus {
	const hasItems = banner.forecast_enabled || banner.emergency_enabled || banner.update_enabled;

	if (!hasItems) {
		return "disabled";
	}

	const now = Date.now();

	if (banner.ends_at && new Date(banner.ends_at).getTime() <= now) {
		return "expired";
	}

	if (banner.starts_at && new Date(banner.starts_at).getTime() > now) {
		return "scheduled";
	}

	return "active";
}

export const BANNER_STATUS_LABEL: Record<BannerStatus, string> = {
	active: "Ενεργό",
	scheduled: "Προγραμματισμένο",
	expired: "Έληξε",
	disabled: "Ανενεργό",
};

// Banner links must be absolute https:// URLs (no javascript:, data:, http:, etc.).
export function isSafeBannerUrl(value: string): boolean {
	try {
		return new URL(value).protocol === "https:";
	} catch {
		return false;
	}
}

export function bannerUrlError(urls: string[]): string | null {
	for (const url of urls) {
		if (url && !isSafeBannerUrl(url)) {
			return "Τα links πρέπει να είναι έγκυρα και να ξεκινούν με https://";
		}
	}

	return null;
}

const MAX_FORECAST_ENTRIES = 4;

export type ForecastEntry = {
	post_id: string;
	starts_at: string | null;
	ends_at: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function localOrNull(value: string): string | null {
	return value ? athensLocalToUTC(value) : null;
}

/** Reads the parallel forecast_post_id[] / forecast_starts_at[] / forecast_ends_at[] fields. */
export function parseForecastEntries(
	formData: FormData,
): { ok: true; value: ForecastEntry[] } | { ok: false; error: string } {
	const ids = formData.getAll("forecast_post_id").map((v) => String(v).trim());
	const starts = formData.getAll("forecast_starts_at").map((v) => String(v).trim());
	const ends = formData.getAll("forecast_ends_at").map((v) => String(v).trim());

	const entries: ForecastEntry[] = [];

	for (let i = 0; i < ids.length; i++) {
		if (!ids[i]) continue; // an empty row is simply ignored

		if (!UUID.test(ids[i])) {
			return { ok: false, error: "Μη έγκυρο άρθρο πρόγνωσης." };
		}

		let starts_at: string | null;
		let ends_at: string | null;

		try {
			starts_at = localOrNull(starts[i] ?? "");
			ends_at = localOrNull(ends[i] ?? "");
		} catch {
			return { ok: false, error: "Μη έγκυρη ημερομηνία στα άρθρα πρόγνωσης." };
		}

		if (starts_at && ends_at && new Date(ends_at) <= new Date(starts_at)) {
			return {
				ok: false,
				error: "Σε κάθε άρθρο πρόγνωσης η λήξη πρέπει να είναι μετά την έναρξη.",
			};
		}

		entries.push({ post_id: ids[i], starts_at, ends_at });
	}

	if (entries.length > MAX_FORECAST_ENTRIES) {
		return { ok: false, error: `Έως ${MAX_FORECAST_ENTRIES} άρθρα πρόγνωσης ανά μπάνερ.` };
	}

	return { ok: true, value: entries };
}
