import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { Markdown } from "@/components/Markdown";
import { OutlookGraphic } from "@/components/outlook/OutlookGraphic";
import { OutlookViewer } from "@/components/outlook/OutlookViewer";
import { formatOutlookDate } from "@/lib/outlook/format";
import { UNOFFICIAL_NOTE } from "@/lib/outlook/types";
import { getPublishedOutlookBySlug } from "@/lib/outlooks";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { plainText } from "@/lib/text";

export const revalidate = 60;

export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: string }>;
}): Promise<Metadata> {
	const { slug } = await params;
	const outlook = await getPublishedOutlookBySlug(slug);

	if (!outlook) return {};

	const description = `Ανεπίσημος χάρτης του GreeceWeather.gr. Έκδοση: ${formatOutlookDate(outlook.issued_at)}.`;

	return {
		title: `${outlook.title} · GreeceWeather`,
		description,
		openGraph: {
			title: outlook.title,
			description,
			type: "article",
			siteName: SITE_NAME,
			locale: "el_GR",
			url: `/outlooks/${outlook.slug}`,
			publishedTime: outlook.published_at ?? outlook.issued_at,
			modifiedTime: outlook.updated_at,
		},
		twitter: { card: "summary_large_image", title: outlook.title, description },
		alternates: { canonical: `/outlooks/${outlook.slug}` },
	};
}

export default async function OutlookPage({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	const outlook = await getPublishedOutlookBySlug(slug);

	if (!outlook) notFound();

	const url = `${SITE_URL}/outlooks/${outlook.slug}`;

	return (
		<div className="container outlook-page">
			<JsonLd
				data={{
					"@context": "https://schema.org",
					"@graph": [
						{
							"@type": "Article",
							"@id": `${url}#article`,
							mainEntityOfPage: url,
							url,
							headline: outlook.title.slice(0, 110),
							description:
								plainText(outlook.summary, 200) ||
								`Ανεπίσημος χάρτης του GreeceWeather.gr. Έκδοση: ${formatOutlookDate(outlook.issued_at)}.`,
							image: [`${url}/opengraph-image`],
							datePublished: outlook.published_at ?? outlook.issued_at,
							dateModified: outlook.updated_at,
							inLanguage: "el-GR",
							author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
							publisher: {
								"@type": "Organization",
								name: SITE_NAME,
								url: SITE_URL,
								logo: { "@type": "ImageObject", url: `${SITE_URL}/icons/icon-512.png` },
							},
						},
						{
							"@type": "BreadcrumbList",
							itemListElement: [
								{ "@type": "ListItem", position: 1, name: "Αρχική", item: SITE_URL },
								{ "@type": "ListItem", position: 2, name: "Χάρτες", item: `${SITE_URL}/outlooks` },
								{ "@type": "ListItem", position: 3, name: outlook.title, item: url },
							],
						},
					],
				}}
			/>

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
