// Helpers for the admin views statistics. Days are Athens days, written "YYYY-MM-DD".

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
	timeZone: "Europe/Athens",
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
});

export function athensDay(date: Date = new Date()): string {
	return dayFormatter.format(date);
}

/** The last `count` days, oldest first, ending today (Athens). */
export function lastDays(count: number): string[] {
	const [y, m, d] = athensDay().split("-").map(Number);

	return Array.from({ length: count }, (_, index) =>
		new Date(Date.UTC(y, m - 1, d - (count - 1 - index))).toISOString().slice(0, 10),
	);
}

export const RANGES = [7, 30, 90] as const;

export function parseRange(value: string | undefined): (typeof RANGES)[number] {
	const n = Number(value);

	return (RANGES as readonly number[]).includes(n) ? (n as (typeof RANGES)[number]) : 30;
}

/** A round number just above `value`, for the top of a chart axis. */
export function niceMax(value: number): number {
	if (value <= 5) return 5;

	const power = 10 ** Math.floor(Math.log10(value));
	const unit = value / power;
	const step = unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10;

	return step * power;
}
