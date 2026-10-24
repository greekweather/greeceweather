import { createOutlookAction } from "@/app/outlook-actions";
import { OutlookForm } from "@/components/admin/OutlookForm";
import { utcToAthensLocal } from "@/lib/date";

export const dynamic = "force-dynamic";

export default function NewOutlookPage() {
	return (
		<>
			<header className="admin-page-header">
				<div>
					<p className="eyebrow">ΠΕΡΙΕΧΟΜΕΝΟ</p>
					<h1>Νέος χάρτης</h1>
					<p>Σχεδίασε τις περιοχές ενδιαφέροντος πάνω στον χάρτη.</p>
				</div>

				<a className="button secondary" href="/admin/outlooks">
					← Επιστροφή
				</a>
			</header>

			<section className="admin-section">
				<OutlookForm
					action={createOutlookAction}
					defaultIssuedLocal={utcToAthensLocal(new Date().toISOString())}
				/>
			</section>
		</>
	);
}
