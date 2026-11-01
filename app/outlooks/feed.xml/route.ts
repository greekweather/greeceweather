import { buildFeed, feedResponse } from "@/lib/feed";
import { formatOutlookDate } from "@/lib/outlook/format";
import { getPublishedOutlooks } from "@/lib/outlooks";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { plainText } from "@/lib/text";

export const revalidate = 600;

const MAX_ITEMS = 30;

// RSS feed of the newest maps. Each item carries the share image of the map.
export async function GET() {
	const outlooks = (await getPublishedOutlooks()).slice(0, MAX_ITEMS);

	return feedResponse(
		buildFeed({
			title: `${SITE_NAME} · Χάρτες`,
			description: "Ανεπίσημοι χάρτες για την ανάπτυξη καταιγίδων και χαμηλών πιέσεων.",
			path: "/outlooks/feed.xml",
			items: outlooks.map((outlook) => {
				const url = `${SITE_URL}/outlooks/${outlook.slug}`;
				const summary = plainText(outlook.summary, 400);

				return {
					title: outlook.title,
					url,
					description: `Ανεπίσημος χάρτης. Έκδοση: ${formatOutlookDate(outlook.issued_at)}.${summary ? ` ${summary}` : ""}`,
					published: outlook.issued_at,
					image: { url: `${url}/opengraph-image`, type: "image/png" },
				};
			}),
		}),
	);
}
