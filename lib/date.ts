const TZ = "Europe/Athens";

const partsFormatter = new Intl.DateTimeFormat("en-CA", {
	timeZone: TZ,
	hourCycle: "h23",
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
	second: "2-digit",
});

function athensParts(utcMs: number) {
	const parts: Record<string, string> = {};
	for (const part of partsFormatter.formatToParts(new Date(utcMs))) {
		parts[part.type] = part.value;
	}
	return parts;
}

// Offset of Athens from UTC at a given instant, in ms.
function athensOffsetMs(utcMs: number): number {
	const p = athensParts(utcMs);
	const asUtc = Date.UTC(
		Number(p.year),
		Number(p.month) - 1,
		Number(p.day),
		Number(p.hour),
		Number(p.minute),
		Number(p.second),
	);
	return asUtc - Math.floor(utcMs / 1000) * 1000;
}

export function athensLocalToUTC(value: string): string {
	const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);

	if (!match) {
		throw new Error("Invalid Athens local date");
	}

	const [, year, month, day, hour, minute, second = "00"] = match;

	const localAsUtc = Date.UTC(
		Number(year),
		Number(month) - 1,
		Number(day),
		Number(hour),
		Number(minute),
		Number(second),
	);

	// Two passes so times near a DST switch resolve correctly.
	const firstGuess = localAsUtc - athensOffsetMs(localAsUtc);
	const utc = localAsUtc - athensOffsetMs(firstGuess);

	return new Date(utc).toISOString();
}

// ISO/UTC -> "YYYY-MM-DDTHH:mm" in Athens time, for <input type="datetime-local">.
export function utcToAthensLocal(value: string | null | undefined): string {
	if (!value) {
		return "";
	}

	const ms = new Date(value).getTime();

	if (Number.isNaN(ms)) {
		return "";
	}

	const p = athensParts(ms);

	return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
