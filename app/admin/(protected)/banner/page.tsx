import { deleteBannerAction } from "@/app/actions";
import { DeleteConfirmButton } from "@/components/admin/DeleteConfirmButton";
import { BANNER_STATUS_LABEL, getBannerStatus } from "@/lib/banner";
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
		.select(
			"id,created_at,updated_at,starts_at,ends_at,forecast_enabled,emergency_enabled,update_enabled",
		)
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
								<th>Έναρξη</th>
								<th>Λήξη</th>
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

								const status = getBannerStatus(banner);

								return (
									<tr key={banner.id}>
										<td>
											<strong>Μπάνερ καιρού</strong>
											<br />
											<small>
												{enabledItems} {enabledItems === 1 ? "ενεργό στοιχείο" : "ενεργά στοιχεία"}
											</small>
										</td>

										<td data-label="Κατάσταση">
											<span className={`status ${status === "active" ? "published" : "draft"}`}>
												{BANNER_STATUS_LABEL[status]}
											</span>
										</td>

										<td data-label="Έναρξη">
											{banner.starts_at ? formatDate(banner.starts_at) : "Άμεσα"}
										</td>
										<td data-label="Λήξη">
											{banner.ends_at ? formatDate(banner.ends_at) : "Χωρίς λήξη"}
										</td>
										<td data-label="Ενημέρωση">{formatDate(banner.updated_at)}</td>

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
