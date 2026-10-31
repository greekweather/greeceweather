export const PAGE_SIZE = 25;

// Splits a list into pages of PAGE_SIZE. An out-of-range or missing page falls back to the
// nearest valid one, so a stale link never shows an empty list.
export function paginate<T>(items: T[], pageParam: string | undefined, pageSize = PAGE_SIZE) {
	const total = items.length;
	const pages = Math.max(1, Math.ceil(total / pageSize));
	const requested = Number.parseInt(pageParam ?? "1", 10);
	const page = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), pages) : 1;
	const start = (page - 1) * pageSize;

	return {
		items: items.slice(start, start + pageSize),
		page,
		pages,
		total,
		pageSize,
		from: total === 0 ? 0 : start + 1,
		to: Math.min(start + pageSize, total),
	};
}

// Page numbers to show: first, last and a window around the current one, with gaps as null.
export function pageWindow(page: number, pages: number): (number | null)[] {
	const wanted = new Set([1, pages, page - 1, page, page + 1]);
	const numbers = [...wanted].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
	const out: (number | null)[] = [];

	for (const [index, n] of numbers.entries()) {
		if (index > 0 && n - (numbers[index - 1] ?? 0) > 1) out.push(null);
		out.push(n);
	}

	return out;
}
