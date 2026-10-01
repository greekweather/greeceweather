import { createBannerAction } from "@/app/actions";
import { BannerForm } from "@/components/admin/BannerForm";

export default function NewBannerPage() {
	return (
		<>
			<header className="admin-page-header">
				<div>
					<p className="eyebrow">ΠΕΡΙΕΧΟΜΕΝΟ</p>
					<h1>Νέο μπάνερ</h1>
					<p>Δημιούργησε ένα νέο μπάνερ για την ιστοσελίδα.</p>
				</div>

				<a className="button secondary" href="/admin/banner">
					← Επιστροφή
				</a>
			</header>

			<section className="admin-section">
				<BannerForm action={createBannerAction} />
			</section>
		</>
	);
}
