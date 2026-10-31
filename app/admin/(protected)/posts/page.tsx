import { deletePostAction } from "@/app/actions";
import { DeleteConfirmButton } from "@/components/admin/DeleteConfirmButton";
import { formatDate } from "@/components/PostCard";
import { createClient } from "@/lib/supabase/server";

// Lower-case, no accents: "καυσωνας" finds "Καύσωνας".
function fold(text: string) {
	return text
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase()
		.replace(/ς/g, "σ");
}

export default async function AdminPostsPage({
	searchParams,
}: {
	searchParams: Promise<{ sort?: string; status?: string; tag?: string; q?: string }>;
}) {
	const { sort, status, tag, q } = await searchParams;

	const view = status === "draft" ? "draft" : status === "published" ? "published" : "all";

	const sortOrder = sort === "oldest" ? "oldest" : sort === "views" ? "views" : "latest";
	const ascending = sortOrder === "oldest";

	const supabase = await createClient();

	const [{ data, error }, { data: tagRows }] = await Promise.all([
		supabase
			.from("posts")
			.select("id,title,slug,published,published_at,views,updated_at,post_tags(tags(id,name))")
			.order(sortOrder === "views" ? "views" : "published_at", {
				ascending: sortOrder === "views" ? false : ascending,
				nullsFirst: false,
			}),
		supabase.from("tags").select("id,name").order("name"),
	]);

	if (error) throw new Error(error.message);

	const allTags = tagRows ?? [];
	const tagId = allTags.some((item) => item.id === tag) ? (tag ?? "") : "";
	const search = (q ?? "").trim().slice(0, 100);

	const withTags = (data ?? []).map((post) => ({
		...post,
		tagList: ((post.post_tags ?? []) as unknown as { tags: { id: string; name: string } | null }[])
			.map((link) => link.tags)
			.filter((item): item is { id: string; name: string } => item !== null)
			.sort((a, b) => a.name.localeCompare(b.name, "el")),
	}));

	// tag and search narrow the list; the tab counts below follow them
	const needle = fold(search);
	const all = withTags.filter(
		(post) =>
			(!tagId || post.tagList.some((item) => item.id === tagId)) &&
			(!needle || fold(`${post.title} ${post.slug}`).includes(needle)),
	);
	const draftCount = all.filter((post) => !post.published).length;

	// Drafts have no publish date, so they are listed by when they were last saved.
	const rows = all
		.filter((post) =>
			view === "all" ? true : view === "draft" ? !post.published : post.published,
		)
		.sort((a, b) => (view === "draft" ? Date.parse(b.updated_at) - Date.parse(a.updated_at) : 0));

	const query = (extra: Record<string, string>) => {
		const params = new URLSearchParams({
			sort: sortOrder,
			...(view === "all" ? {} : { status: view }),
			...(tagId ? { tag: tagId } : {}),
			...(search ? { q: search } : {}),
			...extra,
		});

		for (const [key, value] of [...params]) if (!value) params.delete(key);

		return `/admin/posts?${params.toString()}`;
	};

	return (
		<>
			<header className="admin-page-header">
				<div>
					<p className="eyebrow">ΠΕΡΙΕΧΟΜΕΝΟ</p>
					<h1>Άρθρα</h1>
					<p>Δημιουργία και διαχείριση άρθρων.</p>
				</div>

				<a className="button" href="/admin/posts/new">
					+ Νέο άρθρο
				</a>
			</header>

			<section className="admin-section">
				<form className="admin-post-filters" method="get" action="/admin/posts">
					<input type="hidden" name="sort" value={sortOrder} />
					{view !== "all" && <input type="hidden" name="status" value={view} />}

					<div className="form-field">
						<label htmlFor="post-search">Αναζήτηση</label>
						<input
							id="post-search"
							name="q"
							type="search"
							defaultValue={search}
							placeholder="Τίτλος ή slug…"
						/>
					</div>

					<div className="form-field">
						<label htmlFor="post-tag">Ετικέτα</label>
						<select id="post-tag" name="tag" defaultValue={tagId}>
							<option value="">Όλες οι ετικέτες</option>
							{allTags.map((item) => (
								<option key={item.id} value={item.id}>
									{item.name}
								</option>
							))}
						</select>
					</div>

					<div className="admin-post-filter-actions">
						<button className="button" type="submit">
							Φίλτρο
						</button>

						{(tagId || search) && (
							<a className="button secondary" href={query({ tag: "", q: "" })}>
								Καθαρισμός
							</a>
						)}
					</div>
				</form>

				<div className="admin-status-tabs" role="tablist" aria-label="Κατάσταση άρθρων">
					<a
						role="tab"
						aria-selected={view === "all"}
						className={view === "all" ? "active" : ""}
						href={query({ status: "" })}
					>
						Όλα ({all.length})
					</a>
					<a
						role="tab"
						aria-selected={view === "published"}
						className={view === "published" ? "active" : ""}
						href={query({ status: "published" })}
					>
						Δημοσιευμένα ({all.length - draftCount})
					</a>
					<a
						role="tab"
						aria-selected={view === "draft"}
						className={view === "draft" ? "active" : ""}
						href={query({ status: "draft" })}
					>
						Πρόχειρα ({draftCount})
					</a>
				</div>

				<div className="admin-posts-toolbar">
					<div>
						<strong>Ταξινόμηση</strong>
					</div>

					<div className="admin-sort-buttons">
						<a
							className={`button secondary ${sortOrder === "latest" ? "active" : ""}`}
							href={query({ sort: "latest" })}
						>
							Νεότερα πρώτα
						</a>

						<a
							className={`button secondary ${sortOrder === "oldest" ? "active" : ""}`}
							href={query({ sort: "oldest" })}
						>
							Παλαιότερα πρώτα
						</a>

						<a
							className={`button secondary ${sortOrder === "views" ? "active" : ""}`}
							href={query({ sort: "views" })}
						>
							Περισσότερες προβολές
						</a>
					</div>
				</div>

				<div className="form-card admin-table-wrap">
					<table className="admin-table">
						<thead>
							<tr>
								<th>Τίτλος</th>
								<th>Κατάσταση</th>
								<th>{view === "draft" ? "Τελευταία αποθήκευση" : "Δημοσίευση"}</th>
								<th>Προβολές</th>
								<th></th>
							</tr>
						</thead>

						<tbody>
							{rows.map((post) => (
								<tr key={post.id}>
									<td>
										<strong>
											{post.title || <span className="empty-value">Το άρθρο δεν έχει τίτλο</span>}
										</strong>
										<br />
										<small>{post.slug}</small>

										{post.tagList.length > 0 && (
											<span className="admin-post-tags">
												{post.tagList.map((item) => (
													<a key={item.id} href={query({ tag: item.id })}>
														{item.name}
													</a>
												))}
											</span>
										)}
									</td>

									<td data-label="Κατάσταση">
										<span className={`status ${post.published ? "published" : "draft"}`}>
											{post.published ? "Δημοσιευμένο" : "Πρόχειρο"}
										</span>
									</td>

									<td data-label={view === "draft" ? "Τελευταία αποθήκευση" : "Δημοσίευση"}>
										{post.published ? (
											formatDate(post.published_at)
										) : (
											<>
												{formatDate(post.updated_at)}
												{view !== "draft" && <small> · τελευταία αποθήκευση</small>}
											</>
										)}
									</td>

									<td data-label="Προβολές">{Number(post.views ?? 0).toLocaleString("el-GR")}</td>

									<td
										style={{
											display: "flex",
											gap: 8,
											flexWrap: "wrap",
										}}
									>
										<a className="button secondary" href={`/admin/posts/${post.id}/edit`}>
											Επεξεργασία
										</a>

										<DeleteConfirmButton
											id={post.id}
											name={post.title}
											action={deletePostAction}
											itemType="άρθρου"
											grammar="το άρθρο"
										/>
									</td>
								</tr>
							))}
						</tbody>
					</table>

					{!rows.length && (
						<p>{view === "draft" ? "Δεν υπάρχουν πρόχειρα." : "Δεν υπάρχουν άρθρα."}</p>
					)}
				</div>
			</section>
		</>
	);
}
