import { createOutlookAction } from "@/app/outlook-actions";
import { OutlookForm, type OutlookFormValues } from "@/components/admin/OutlookForm";
import { utcToAthensLocal } from "@/lib/date";
import { OUTLOOK_COLUMNS, toOutlook } from "@/lib/outlooks";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function NewOutlookPage({
	searchParams,
}: {
	searchParams: Promise<{ from?: string }>;
}) {
	const { from } = await searchParams;

	// "Αντίγραφο": start from an earlier map (areas, storms, title, legend, text). The new one
	// gets a fresh issue time and slug, and stays a draft until it is published.
	let source: OutlookFormValues | undefined;
	let sourceTitle = "";

	if (from && UUID.test(from)) {
		const supabase = await createClient();
		const { data } = await supabase
			.from("outlooks")
			.select(OUTLOOK_COLUMNS)
			.eq("id", from)
			.maybeSingle();

		if (data) {
			const original = toOutlook(data);
			sourceTitle = original.title;
			source = {
				title: original.title,
				slug: "",
				summary: original.summary,
				map_data: original.map_data,
				legend_position: original.legend_position,
				issued_at: null,
				valid_until: null,
				published: false,
			};
		}
	}

	return (
		<>
			<header className="admin-page-header">
				<div>
					<p className="eyebrow">ΠΕΡΙΕΧΟΜΕΝΟ</p>
					<h1>Νέος χάρτης</h1>
					<p>
						{source
							? `Αντίγραφο του «${sourceTitle}». Άλλαξε ό,τι χρειάζεται και αποθήκευσέ το.`
							: "Σχεδίασε τις περιοχές ενδιαφέροντος πάνω στον χάρτη."}
					</p>
				</div>

				<a className="button secondary" href="/admin/outlooks">
					← Επιστροφή
				</a>
			</header>

			<section className="admin-section">
				<OutlookForm
					action={createOutlookAction}
					outlook={source}
					defaultIssuedLocal={utcToAthensLocal(new Date().toISOString())}
				/>
			</section>
		</>
	);
}
