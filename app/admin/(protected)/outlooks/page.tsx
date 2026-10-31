import { deleteOutlookAction } from "@/app/outlook-actions";
import { DeleteConfirmButton } from "@/components/admin/DeleteConfirmButton";
import { formatOutlookDate } from "@/lib/outlook/format";
import { createClient } from "@/lib/supabase/server";
import { isLive } from "@/lib/visibility";

export default async function AdminOutlooksPage() {
	const supabase = await createClient();

	const { data, error } = await supabase
		.from("outlooks")
		.select("id,title,slug,issued_at,valid_until,published,published_at,updated_at")
		.order("issued_at", { ascending: false });

	if (error) {
		throw new Error(error.message);
	}

	return (
		<>
			<header className="admin-page-header">
				<div>
					<p className="eyebrow">ΠΕΡΙΕΧΟΜΕΝΟ</p>
					<h1>Χάρτες</h1>
					<p>Ανεπίσημοι χάρτες πιθανότητας ανάπτυξης συστημάτων.</p>
				</div>

				<a className="button" href="/admin/outlooks/new">
					+ Νέος χάρτης
				</a>
			</header>

			<section className="admin-section">
				<div className="form-card admin-table-wrap">
					<table className="admin-table">
						<thead>
							<tr>
								<th>Τίτλος</th>
								<th>Κατάσταση</th>
								<th>Έκδοση</th>
								<th>Ενημέρωση</th>
								<th></th>
							</tr>
						</thead>

						<tbody>
							{(data ?? []).map((outlook) => (
								<tr key={outlook.id}>
									<td>
										<strong>{outlook.title}</strong>
										<br />
										<small>/outlooks/{outlook.slug}</small>
									</td>

									<td data-label="Κατάσταση">
										<span className={`status ${outlook.published ? "published" : "draft"}`}>
											{outlook.published ? "Δημοσιευμένη" : "Πρόχειρο"}
										</span>
									</td>

									<td data-label="Έκδοση">{formatOutlookDate(outlook.issued_at)}</td>
									<td data-label="Ενημέρωση">{formatOutlookDate(outlook.updated_at)}</td>

									<td>
										<div className="outlook-row-actions">
											<div className="outlook-row-actions-top">
												<a
													className="button secondary"
													href={`/admin/outlooks/${outlook.id}/edit`}
												>
													Επεξεργασία
												</a>

												<a
													className="button secondary"
													href={`/admin/outlooks/new?from=${outlook.id}`}
												>
													Αντίγραφο
												</a>

												{isLive(outlook.published, outlook.published_at, outlook.issued_at) && (
													<a
														className="button secondary"
														href={`/outlooks/${outlook.slug}`}
														target="_blank"
														rel="noopener noreferrer"
													>
														Προβολή ↗
													</a>
												)}
											</div>

											<div className="outlook-row-actions-bottom">
												<DeleteConfirmButton
													id={outlook.id}
													name={outlook.title}
													action={deleteOutlookAction}
													itemType="χάρτη"
													grammar="τον χάρτη"
												/>
											</div>
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>

					{!data?.length && <p>Δεν υπάρχουν χάρτες.</p>}
				</div>
			</section>
		</>
	);
}
