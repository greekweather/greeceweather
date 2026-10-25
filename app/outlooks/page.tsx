import type { Metadata } from "next";
import Link from "next/link";
import { ArchiveSearch } from "@/components/outlook/ArchiveSearch";
import { OutlookViewer } from "@/components/outlook/OutlookViewer";
import { OutlookGraphic } from "@/components/outlook/OutlookGraphic";
import { formatOutlookDate, outlookDateKey } from "@/lib/outlook/format";
import { UNOFFICIAL_NOTE } from "@/lib/outlook/types";
import { getPublishedOutlooks } from "@/lib/outlooks";

export const revalidate = 60;

export const metadata: Metadata = {
	title: "Χάρτες · GreeceWeather",
	description:
		"Ανεπίσημοι χάρτες για την ανάπτυξη καταιγίδων και χαμηλών πιέσεων στη Μεσόγειο και την Ευρώπη.",
};

export default async function OutlooksPage() {
	const outlooks = await getPublishedOutlooks();
	const [latest] = outlooks;

	return (
		<div className="container outlook-page">
			<header className="outlook-page-header">
				<p className="eyebrow">ΧΑΡΤΕΣ</p>
				<h1>Χάρτες καιρού</h1>
				<p className="outlook-disclaimer" role="note">
					<strong>Ανεπίσημο:</strong> {UNOFFICIAL_NOTE}
				</p>
			</header>

			{!latest ? (
				<p>Δεν υπάρχει δημοσιευμένος χάρτης αυτή τη στιγμή.</p>
			) : (
				<>
					<section aria-labelledby="latest-title">
						<h2 id="latest-title">
							<Link href={`/outlooks/${latest.slug}`}>{latest.title}</Link>
						</h2>

						<p className="post-meta">Έκδοση: {formatOutlookDate(latest.issued_at)}</p>

						<OutlookViewer>
							<OutlookGraphic
								title={latest.title}
								data={latest.map_data}
								issuedText={formatOutlookDate(latest.issued_at)}
								validText={latest.valid_until ? formatOutlookDate(latest.valid_until) : undefined}
								legendPosition={latest.legend_position}
								idPrefix="latest"
							/>
						</OutlookViewer>

						<p>
							<Link className="button secondary" href={`/outlooks/${latest.slug}`}>
								Άνοιγμα χάρτη και πλήρους πρόγνωσης
							</Link>
						</p>
					</section>

					{outlooks.length > 1 && (
						<ArchiveSearch
							latestId={latest.id}
							items={outlooks.map((outlook) => ({
								id: outlook.id,
								title: outlook.title,
								slug: outlook.slug,
								dateKey: outlookDateKey(outlook.issued_at),
								label: formatOutlookDate(outlook.issued_at),
							}))}
						/>
					)}
				</>
			)}
		</div>
	);
}
