import { notFound } from "next/navigation";
import { deleteBannerAction, updateBannerAction } from "@/app/actions";
import { BannerForm } from "@/components/admin/BannerForm";
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

export default async function EditBannerPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;

	const supabase = await createClient();

	const { data: banner, error } = await supabase
		.from("weather_banner")
		.select(
			"id,created_at,updated_at,forecast_enabled,forecast_url,emergency_enabled,emergency_url,update_enabled,update_url",
		)
		.eq("id", id)
		.single();

	if (error || !banner) {
		notFound();
	}

	return (
		<>
			<header className="admin-page-header">
				<div>
					<p className="eyebrow">ΠΕΡΙΕΧΟΜΕΝΟ</p>
					<h1>Επεξεργασία μπάνερ</h1>
					<p>Τροποποίησε τα στοιχεία του μπάνερ.</p>
				</div>

				<a className="button secondary" href="/admin/banner">
					← Επιστροφή
				</a>
			</header>

			<section className="admin-section">
				<BannerForm action={updateBannerAction} banner={banner}>
					<DeleteConfirmButton
						id={banner.id}
						name="Μπάνερ καιρού"
						action={deleteBannerAction}
						itemType="μπάνερ"
						grammar="το μπάνερ"
						useParentForm
					/>
				</BannerForm>

				<div className="form-card" style={{ marginTop: 16 }}>
					<div className="form-field">
						<label htmlFor="created-at">Δημιουργήθηκε</label>
						<input
							id="created-at"
							type="text"
							value={formatDate(banner.created_at)}
							disabled
							readOnly
						/>
					</div>

					<div className="form-field">
						<label htmlFor="updated-at">Τελευταία ενημέρωση</label>
						<input
							id="updated-at"
							type="text"
							value={formatDate(banner.updated_at)}
							disabled
							readOnly
						/>
					</div>
				</div>
			</section>
		</>
	);
}
