import { deletePostAction } from "@/app/actions";
import { DeleteConfirmButton } from "@/components/admin/DeleteConfirmButton";
import { formatDate } from "@/components/PostCard";
import { createClient } from "@/lib/supabase/server";

export default async function AdminPostsPage({
	searchParams,
}: {
	searchParams: Promise<{ sort?: string }>;
}) {
	const { sort } = await searchParams;

	const sortOrder = sort === "oldest" ? "oldest" : "latest";
	const ascending = sortOrder === "oldest";

	const supabase = await createClient();

	const { data, error } = await supabase
		.from("posts")
		.select("id,title,slug,published,published_at,views,updated_at")
		.order("published_at", { ascending });

	if (error) throw new Error(error.message);

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
				<div className="admin-posts-toolbar">
					<div>
						<strong>Ταξινόμηση</strong>
					</div>

					<div className="admin-sort-buttons">
						<a
							className={`button secondary ${sortOrder === "latest" ? "active" : ""}`}
							href="/admin/posts?sort=latest"
						>
							Νεότερα πρώτα
						</a>

						<a
							className={`button secondary ${sortOrder === "oldest" ? "active" : ""}`}
							href="/admin/posts?sort=oldest"
						>
							Παλαιότερα πρώτα
						</a>
					</div>
				</div>

				<div className="form-card admin-table-wrap">
					<table className="admin-table">
						<thead>
							<tr>
								<th>Τίτλος</th>
								<th>Κατάσταση</th>
								<th>Δημοσίευση</th>
								<th>Προβολές</th>
								<th></th>
							</tr>
						</thead>

						<tbody>
							{(data ?? []).map((post) => (
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

									<td>{formatDate(post.published_at)}</td>

									<td>{post.views}</td>

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

					{!data?.length && <p>Δεν υπάρχουν άρθρα.</p>}
				</div>
			</section>
		</>
	);
}
