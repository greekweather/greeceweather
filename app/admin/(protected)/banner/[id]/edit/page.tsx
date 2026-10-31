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
			"id,title,created_at,updated_at,starts_at,ends_at,forecast_enabled,forecast_url,emergency_enabled,emergency_url,update_enabled,update_url",
		)
		.eq("id", id)
		.single();

	if (error || !banner) {
		notFound();
	}

	const [{ data: posts }, { data: forecasts }] = await Promise.all([
		supabase
			.from("posts")
			.select("id,title")
			.eq("published", true)
			.order("published_at", { ascending: false })
			.limit(100),
		supabase
			.from("banner_forecast_posts")
			.select("post_id,starts_at,ends_at")
			.eq("banner_id", id)
			.order("starts_at", { ascending: true, nullsFirst: true }),
	]);

	return (
		<>
			<header className="admin-page-header">
				<div>
					<p className="eyebrow">ΠΕΡΙΕΧΟΜΕΝΟ</p>
					<h1>Επεξεργασία μπάνερ</h1>
					<p>Τροποποίησε τα στοιχεία του μπάνερ.</p>
				</div>

				<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
					<a className="button secondary" href="/" target="_blank" rel="noopener noreferrer">
						Δες στην αρχική ↗
					</a>
					<a className="button secondary" href="/admin/banner">
						← Επιστροφή
					</a>
				</div>
			</header>

			<section className="admin-section">
				<BannerForm
					action={updateBannerAction}
					banner={banner}
					posts={posts ?? []}
					forecasts={forecasts ?? []}
				>
					<DeleteConfirmButton
						id={banner.id}
						name="Μπάνερ καιρού"
						action={deleteBannerAction}
						itemType="μπάνερ"
						grammar="το μπάνερ"
						parentFormId="banner-form"
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
