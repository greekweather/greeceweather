import { notFound } from "next/navigation";
import { deleteOutlookAction, updateOutlookAction } from "@/app/outlook-actions";
import { DeleteConfirmButton } from "@/components/admin/DeleteConfirmButton";
import { OutlookForm } from "@/components/admin/OutlookForm";
import { utcToAthensLocal } from "@/lib/date";
import { OUTLOOK_COLUMNS, toOutlook } from "@/lib/outlooks";
import { createClient } from "@/lib/supabase/server";

export default async function EditOutlookPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;

	const supabase = await createClient();

	const { data, error } = await supabase
		.from("outlooks")
		.select(OUTLOOK_COLUMNS)
		.eq("id", id)
		.single();

	if (error || !data) {
		notFound();
	}

	const outlook = toOutlook(data);

	return (
		<>
			<header className="admin-page-header">
				<div>
					<p className="eyebrow">ΠΕΡΙΕΧΟΜΕΝΟ</p>
					<h1>Επεξεργασία χάρτη</h1>
					<p>{outlook.title}</p>
				</div>

				<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
					<a className="button secondary" href={`/admin/outlooks/new?from=${outlook.id}`}>
						Δημιουργία αντιγράφου
					</a>
					<a className="button secondary" href="/admin/outlooks">
						← Επιστροφή
					</a>
				</div>
			</header>

			<section className="admin-section">
				<OutlookForm
					action={updateOutlookAction}
					outlook={outlook}
					defaultIssuedLocal={utcToAthensLocal(outlook.issued_at)}
				>
					<DeleteConfirmButton
						id={outlook.id}
						name={outlook.title}
						action={deleteOutlookAction}
						itemType="χάρτη"
						grammar="τον χάρτη"
						parentFormId="outlook-form"
					/>
				</OutlookForm>
			</section>
		</>
	);
}
