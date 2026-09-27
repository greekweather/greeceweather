import { deleteTagAction } from "@/app/actions";
import { DeleteConfirmButton } from "@/components/admin/DeleteConfirmButton";
import { createClient } from "@/lib/supabase/server";

export default async function AdminTagsPage() {
	const supabase = await createClient();

	const { data: tags, error } = await supabase
		.from("tags")
		.select("id,name,slug,created_at,post_tags(count)")
		.order("name", { ascending: true });

	if (error) {
		throw new Error(error.message);
	}

	return (
		<>
			<header className="admin-page-header">
				<div>
					<p className="eyebrow">ΠΕΡΙΕΧΟΜΕΝΟ</p>
					<h1>Ετικέτες</h1>
					<p>Διαχείριση των ετικετών των άρθρων.</p>
				</div>

				<a className="button" href="/admin/tags/new">
					+ Νέα ετικέτα
				</a>
			</header>

			<section className="admin-section">
				<div className="form-card admin-table-wrap">
					<table className="admin-table">
						<thead>
							<tr>
								<th>Ετικέτα</th>
								<th>Slug</th>
								<th>Άρθρα</th>
								<th>Δημιουργήθηκε</th>
								<th></th>
							</tr>
						</thead>

						<tbody>
							{(tags ?? []).map((tag) => {
								const postCount = Array.isArray(tag.post_tags)
									? (tag.post_tags[0]?.count ?? 0)
									: 0;

								return (
									<tr key={tag.id}>
										<td>
											<strong>{tag.name}</strong>
										</td>

										<td>
											<small>{tag.slug}</small>
										</td>

										<td>{postCount}</td>

										<td>
											{new Intl.DateTimeFormat("el-GR", {
												timeZone: "Europe/Athens",
												day: "2-digit",
												month: "2-digit",
												year: "numeric",
											}).format(new Date(tag.created_at))}
										</td>

										<td style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
											<a className="button secondary" href={`/admin/tags/${tag.id}/edit`}>
												Επεξεργασία
											</a>

											<DeleteConfirmButton
												id={tag.id}
												name={tag.name}
												action={deleteTagAction}
												itemType="ετικέτας"
												grammar="την ετικέτα"
											/>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>

					{!tags?.length && <p>Δεν υπάρχουν ετικέτες.</p>}
				</div>
			</section>
		</>
	);
}
