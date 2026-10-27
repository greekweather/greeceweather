import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/Markdown";
import { OutlookGraphic } from "@/components/outlook/OutlookGraphic";
import { OutlookViewer } from "@/components/outlook/OutlookViewer";
import { formatOutlookDate } from "@/lib/outlook/format";
import { UNOFFICIAL_NOTE } from "@/lib/outlook/types";
import { getPublishedOutlookBySlug } from "@/lib/outlooks";

export const revalidate = 60;

export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: string }>;
}): Promise<Metadata> {
	const { slug } = await params;
	const outlook = await getPublishedOutlookBySlug(slug);

	if (!outlook) return {};

	return {
		title: `${outlook.title} · GreeceWeather`,
		description: `Ανεπίσημος χάρτης του GreeceWeather.gr. Έκδοση: ${formatOutlookDate(outlook.issued_at)}.`,
	};
}

export default async function OutlookPage({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	const outlook = await getPublishedOutlookBySlug(slug);

	if (!outlook) notFound();

	return (
		<div className="container outlook-page">
			<Link className="back-link" href="/outlooks">
				← Όλοι οι χάρτες
			</Link>

			<header className="outlook-page-header">
				<p className="post-meta">Έκδοση: {formatOutlookDate(outlook.issued_at)}</p>
				<h1>{outlook.title}</h1>
				<p className="outlook-disclaimer" role="note">
					<strong>Ανεπίσημο.</strong> {UNOFFICIAL_NOTE}
				</p>
			</header>

			<OutlookViewer fileName={outlook.slug}>
				<OutlookGraphic
					title={outlook.title}
					data={outlook.map_data}
					issuedText={formatOutlookDate(outlook.issued_at)}
					validText={outlook.valid_until ? formatOutlookDate(outlook.valid_until) : undefined}
					legendPosition={outlook.legend_position}
					idPrefix="page"
				/>
			</OutlookViewer>

			{outlook.summary && (
				<div className="article-body outlook-summary">
					<Markdown content={outlook.summary} />
				</div>
			)}
		</div>
	);
}
