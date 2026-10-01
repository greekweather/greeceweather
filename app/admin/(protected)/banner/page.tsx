import { deleteBannerAction } from "@/app/actions";
import { DeleteConfirmButton } from "@/components/admin/DeleteConfirmButton";
import { createClient } from "@/lib/supabase/server";

function formatDate(date: string | null) {
	if (!date) {
		return "—";
	}

	return new Intl.DateTimeFormat("el-GR", {
		dateStyle: "short",
		timeStyle: "short",
		timeZone: "Europe/Athens",
	}).format(new Date(date));
}

export default async function AdminBannerPage() {
	const supabase = await createClient();

	const { data, error } = await supabase
		.from("weather_banner")
		.select("id,created_at,updated_at,forecast_enabled,emergency_enabled,update_enabled")
		.order("created_at", { ascending: false });

	if (error) {
		throw new Error(error.message);
	}

	return (
		<>
			<header className="admin-page-header">
				<div>
					<p className="eyebrow">ΠΕΡΙΕΧΟΜΕΝΟ</p>
					<h1>Μπάνερ</h1>
					<p>Δημιουργία και διαχείριση μπάνερ.</p>
				</div>

				<a className="button" href="/admin/banner/new">
					+ Νέο μπάνερ
				</a>
			</header>

			<section className="admin-section">
				<div className="form-card admin-table-wrap">
					<table className="admin-table">
						<thead>
							<tr>
								<th>Περιεχόμενο</th>
								<th>Κατάσταση</th>
								<th>Δημιουργία</th>
								<th>Ενημέρωση</th>
								<th></th>
							</tr>
						</thead>

						<tbody>
							{(data ?? []).map((banner) => {
								const enabledItems = [
									banner.forecast_enabled,
									banner.emergency_enabled,
									banner.update_enabled,
								].filter(Boolean).length;

								return (
									<tr key={banner.id}>
										<td>
											<strong>Μπάνερ καιρού</strong>
											<br />
											<small>
												{enabledItems} {enabledItems === 1 ? "ενεργό στοιχείο" : "ενεργά στοιχεία"}
											</small>
										</td>

										<td>
											<span className={`status ${enabledItems > 0 ? "published" : "draft"}`}>
												{enabledItems > 0 ? "Ενεργό" : "Ανενεργό"}
											</span>
										</td>

										<td>{formatDate(banner.created_at)}</td>
										<td>{formatDate(banner.updated_at)}</td>

										<td style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
											<a className="button secondary" href={`/admin/banner/${banner.id}/edit`}>
												Επεξεργασία
											</a>

											<DeleteConfirmButton
												id={banner.id}
												name="Μπάνερ καιρού"
												action={deleteBannerAction}
												itemType="μπάνερ"
												grammar="το μπάνερ"
											/>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>

					{!data?.length && <p>Δεν υπάρχουν μπάνερ.</p>}
				</div>
			</section>
		</>
	);
}
