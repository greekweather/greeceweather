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

export type BannerStatus = "active" | "scheduled" | "expired" | "disabled";

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
