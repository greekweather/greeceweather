import { Pagination } from "@/components/admin/Pagination";
import { ViewsChart } from "@/components/admin/ViewsChart";
import { paginate } from "@/lib/pagination";
import { lastDays, parseRange, RANGES } from "@/lib/stats";
import { createClient } from "@/lib/supabase/server";

type DayRow = { slug: string; day: string; views: number };

const ROWS_PER_REQUEST = 1000;

export default async function StatsPage({
	searchParams,
}: {
	searchParams: Promise<{ range?: string; post?: string; page?: string }>;
}) {
	const params = await searchParams;
	const range = parseRange(params.range);
	const days = lastDays(range);
	const supabase = await createClient();

	const { data: posts, error: postsError } = await supabase
		.from("posts")
		.select("slug,title,views,published")
		.order("views", { ascending: false });

	if (postsError) throw new Error(postsError.message);

	// one request returns at most 1000 rows, and a busy month has more than that
	const rows: DayRow[] = [];
	let missingTable: string | null = null;

	for (let from = 0; ; from += ROWS_PER_REQUEST) {
		const { data, error } = await supabase
			.from("post_view_days")
			.select("slug,day,views")
			.gte("day", days[0])
			.order("day", { ascending: true })
			.order("slug", { ascending: true })
			.range(from, from + ROWS_PER_REQUEST - 1);

		if (error) {
			missingTable = error.message;
			break;
		}

		rows.push(...(data as DayRow[]));

		if ((data?.length ?? 0) < ROWS_PER_REQUEST) break;
	}

	const selected = (posts ?? []).find((post) => post.slug === params.post) ?? null;

	const perDay = new Map<string, number>(days.map((day) => [day, 0]));
	const perPost = new Map<string, number>();

	for (const row of rows) {
		perPost.set(row.slug, (perPost.get(row.slug) ?? 0) + row.views);

		if (!selected || selected.slug === row.slug) {
			perDay.set(row.day, (perDay.get(row.day) ?? 0) + row.views);
		}
	}

	const points = days.map((day) => ({ day, views: perDay.get(day) ?? 0 }));
	const inRange = points.reduce((sum, point) => sum + point.views, 0);
	const today = points.at(-1)?.views ?? 0;
	const last7 = points.slice(-7).reduce((sum, point) => sum + point.views, 0);
	const total = selected
		? selected.views
		: (posts ?? []).reduce((sum, post) => sum + (post.views ?? 0), 0);

	const table = (posts ?? [])
		.map((post) => ({ ...post, recent: perPost.get(post.slug) ?? 0 }))
		.sort((a, b) => b.recent - a.recent || b.views - a.views);

	const pager = paginate(table, params.page);
	const topRecent = Math.max(1, ...table.map((post) => post.recent));

	const query = (patch: Record<string, string | undefined>) => {
		const next = new URLSearchParams();
		const merged = { range: String(range), post: selected?.slug, ...patch };

		for (const [key, value] of Object.entries(merged)) {
			if (value) next.set(key, value);
		}

		return `/admin/stats?${next.toString()}`;
	};

	return (
		<>
			<header className="admin-page-header">
				<div>
					<p className="eyebrow">ΣΥΣΤΗΜΑ</p>
					<h1>Στατιστικά επισκέψεων</h1>
					<p>
						{selected ? `Προβολές του άρθρου «${selected.title}».` : "Προβολές όλων των άρθρων."}
					</p>
				</div>
			</header>

			<section className="admin-section">
				{missingTable && (
					<p className="form-warning" role="alert">
						Η καταγραφή ανά ημέρα δεν είναι ενεργή ({missingTable}). Τρέξε το
						supabase/changes-2026-11-01.sql. Οι προβολές ανά ημέρα μετρούν από τη στιγμή που θα το
						τρέξεις.
					</p>
				)}

				<div className="stats-tiles">
					<div className="form-card stats-tile">
						<span>Σήμερα</span>
						<strong>{today}</strong>
					</div>
					<div className="form-card stats-tile">
						<span>Τελευταίες 7 ημέρες</span>
						<strong>{last7}</strong>
					</div>
					<div className="form-card stats-tile">
						<span>Τελευταίες {range} ημέρες</span>
						<strong>{inRange}</strong>
					</div>
					<div className="form-card stats-tile">
						<span>Συνολικά</span>
						<strong>{total}</strong>
					</div>
				</div>

				<div className="form-card stats-card">
					<div className="stats-card-head">
						<h2>Προβολές ανά ημέρα</h2>

						<nav className="stats-ranges" aria-label="Διάστημα">
							{RANGES.map((n) => (
								<a
									key={n}
									href={query({ range: String(n), page: undefined })}
									className={`button secondary ${n === range ? "current" : ""}`}
									aria-current={n === range ? "true" : undefined}
								>
									{n} ημ.
								</a>
							))}
						</nav>
					</div>

					{selected && (
						<p className="stats-filter">
							Άρθρο: <strong>{selected.title}</strong>{" "}
							<a href={query({ post: undefined })}>Όλα τα άρθρα</a>
						</p>
					)}

					<ViewsChart points={points} label={selected?.title ?? "Όλα τα άρθρα"} />

					<p className="stats-note">
						Μετράει μία προβολή ανά επισκέπτη κάθε λίγα λεπτά και όχι τα bots, όπως ο μετρητής του
						άρθρου. Το «Συνολικά» είναι ο παλιός μετρητής και περιλαμβάνει και ό,τι υπήρχε πριν
						ξεκινήσει η καταγραφή ανά ημέρα.
					</p>
				</div>

				<div className="form-card stats-card">
					<h2>Ανά άρθρο (τελευταίες {range} ημέρες)</h2>

					<div className="admin-table-wrap">
						<table className="admin-table">
							<thead>
								<tr>
									<th>Άρθρο</th>
									<th>{range} ημέρες</th>
									<th>Συνολικά</th>
									<th></th>
								</tr>
							</thead>

							<tbody>
								{pager.items.map((post) => (
									<tr key={post.slug}>
										<td>
											<strong>{post.title}</strong>
											{!post.published && <small> · πρόχειρο</small>}
											<span className="stats-bar" aria-hidden="true">
												<span style={{ width: `${(post.recent / topRecent) * 100}%` }} />
											</span>
										</td>
										<td data-label={`${range} ημέρες`}>{post.recent}</td>
										<td data-label="Συνολικά">{post.views ?? 0}</td>
										<td>
											<a
												className="button secondary"
												href={query({ post: post.slug, page: undefined })}
											>
												Γράφημα
											</a>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>

					<Pagination {...pager} href={(n) => query({ page: String(n) })} />
				</div>
			</section>
		</>
	);
}
