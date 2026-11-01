import { SITE_NAME, SITE_URL } from "@/lib/site";
import { xmlEscape } from "@/lib/text";

export type FeedItem = {
	title: string;
	url: string;
	description: string;
	published: string;
	categories?: string[];
	/** Absolute address of a picture, sent as an <enclosure>. */
	image?: { url: string; type: string } | null;
};

function rfc822(value: string): string {
	return new Date(value).toUTCString();
}

// RSS 2.0 with an atom:link to itself, which feed readers and validators expect.
export function buildFeed({
	title,
	description,
	path,
	items,
}: {
	title: string;
	description: string;
	path: string;
	items: FeedItem[];
}): string {
	const self = `${SITE_URL}${path}`;
	const newest = items[0]?.published;

	const body = items
		.map(
			(item) => `    <item>
      <title>${xmlEscape(item.title)}</title>
      <link>${xmlEscape(item.url)}</link>
      <guid isPermaLink="true">${xmlEscape(item.url)}</guid>
      <pubDate>${rfc822(item.published)}</pubDate>
      <description>${xmlEscape(item.description)}</description>${(item.categories ?? [])
				.map((category) => `\n      <category>${xmlEscape(category)}</category>`)
				.join("")}${
				item.image
					? `\n      <enclosure url="${xmlEscape(item.image.url)}" type="${xmlEscape(item.image.type)}" length="0"/>`
					: ""
			}
    </item>`,
		)
		.join("\n");

	return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEscape(title)}</title>
    <link>${SITE_URL}</link>
    <description>${xmlEscape(description)}</description>
    <language>el</language>
    <generator>${SITE_NAME}</generator>
    <atom:link href="${xmlEscape(self)}" rel="self" type="application/rss+xml"/>${
			newest ? `\n    <lastBuildDate>${rfc822(newest)}</lastBuildDate>` : ""
		}
${body}
  </channel>
</rss>
`;
}

export function feedResponse(xml: string): Response {
	return new Response(xml, {
		headers: {
			"Content-Type": "application/rss+xml; charset=utf-8",
			"Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600",
		},
	});
}

export function imageMimeType(url: string): string {
	const ext = url.split("?")[0].split(".").pop()?.toLowerCase();

	if (ext === "png") return "image/png";
	if (ext === "gif") return "image/gif";
	if (ext === "webp") return "image/webp";

	return "image/jpeg";
}
