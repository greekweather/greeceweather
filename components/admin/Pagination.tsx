import { pageWindow } from "@/lib/pagination";

// Page links under an admin list. `href(n)` builds the link for page n, so each list keeps
// its own filters and sorting when the page changes.
export function Pagination({
	page,
	pages,
	total,
	from,
	to,
	href,
}: {
	page: number;
	pages: number;
	total: number;
	from: number;
	to: number;
	href: (page: number) => string;
}) {
	if (total === 0) return null;

	return (
		<nav className="admin-pager" aria-label="Σελίδες">
			<p className="admin-pager-summary">
				{from}–{to} από {total}
			</p>

			{pages > 1 && (
				<ul>
					<li>
						{page > 1 ? (
							<a href={href(page - 1)} rel="prev" aria-label="Προηγούμενη σελίδα">
								←
							</a>
						) : (
							<span className="disabled" aria-hidden="true">
								←
							</span>
						)}
					</li>

					{pageWindow(page, pages).map((n, index) => (
						<li key={n ?? `gap-${index}`}>
							{n === null ? (
								<span className="gap">…</span>
							) : n === page ? (
								<span className="current" aria-current="page">
									{n}
								</span>
							) : (
								<a href={href(n)}>{n}</a>
							)}
						</li>
					))}

					<li>
						{page < pages ? (
							<a href={href(page + 1)} rel="next" aria-label="Επόμενη σελίδα">
								→
							</a>
						) : (
							<span className="disabled" aria-hidden="true">
								→
							</span>
						)}
					</li>
				</ul>
			)}
		</nav>
	);
}
