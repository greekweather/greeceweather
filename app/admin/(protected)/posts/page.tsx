import { deletePostAction } from "@/app/actions";
import { DeleteConfirmButton } from "@/components/admin/DeleteConfirmButton";
import { formatDate } from "@/components/PostCard";
import { createClient } from "@/lib/supabase/server";

export default async function AdminPostsPage({
	searchParams,
}: {
	searchParams: Promise<{ sort?: string; status?: string }>;
}) {
	const { sort, status } = await searchParams;

	const view = status === "draft" ? "draft" : status === "published" ? "published" : "all";

	const sortOrder = sort === "oldest" ? "oldest" : sort === "views" ? "views" : "latest";
	const ascending = sortOrder === "oldest";

	const supabase = await createClient();

	const { data, error } = await supabase
		.from("posts")
		.select("id,title,slug,published,published_at,views,updated_at")
		.order(sortOrder === "views" ? "views" : "published_at", {
			ascending: sortOrder === "views" ? false : ascending,
			nullsFirst: false,
		});

	if (error) throw new Error(error.message);

	const all = data ?? [];
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
			...extra,
		});
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
				<div className="admin-status-tabs" role="tablist" aria-label="Κατάσταση άρθρων">
					<a
						role="tab"
						aria-selected={view === "all"}
						className={view === "all" ? "active" : ""}
						href={`/admin/posts?sort=${sortOrder}`}
					>
						Όλα ({all.length})
					</a>
					<a
						role="tab"
						aria-selected={view === "published"}
						className={view === "published" ? "active" : ""}
						href={`/admin/posts?sort=${sortOrder}&status=published`}
					>
						Δημοσιευμένα ({all.length - draftCount})
					</a>
					<a
						role="tab"
						aria-selected={view === "draft"}
						className={view === "draft" ? "active" : ""}
						href={`/admin/posts?sort=${sortOrder}&status=draft`}
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
									</td>

									<td>
										<span className={`status ${post.published ? "published" : "draft"}`}>
											{post.published ? "Δημοσιευμένο" : "Πρόχειρο"}
										</span>
									</td>

									<td>
										{post.published ? (
											formatDate(post.published_at)
										) : (
											<>
												{formatDate(post.updated_at)}
												{view !== "draft" && <small> · τελευταία αποθήκευση</small>}
											</>
										)}
									</td>

									<td>{Number(post.views ?? 0).toLocaleString("el-GR")}</td>

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
