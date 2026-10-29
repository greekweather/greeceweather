/** "Σάβ 24 Οκτ 2026, 03:00" in Athens time. */
export function formatOutlookDate(value: string | null | undefined): string {
	if (!value) return "";
	const parts = new Intl.DateTimeFormat("el-GR", {
		timeZone: "Europe/Athens",
		weekday: "short",
		day: "numeric",
		month: "short",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	}).format(new Date(value));
	return parts.replace(/\.(?=\s|$)/g, "");
}

/** "YYYY-MM-DD" of the instant in Athens time, the format of <input type="date">. */
export function outlookDateKey(value: string): string {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: "Europe/Athens",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(new Date(value));
}
