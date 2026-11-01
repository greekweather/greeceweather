import { buildFeed, feedResponse, imageMimeType } from "@/lib/feed";
import { getPublishedPosts } from "@/lib/posts";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

export const revalidate = 600;

const MAX_ITEMS = 30;

// RSS feed of the newest articles.
export async function GET() {
	const posts = await getPublishedPosts(MAX_ITEMS);

	return feedResponse(
		buildFeed({
			title: `${SITE_NAME} · Άρθρα`,
			description: SITE_DESCRIPTION,
			path: "/feed.xml",
			items: posts.map((post) => ({
				title: post.title,
				url: `${SITE_URL}/posts/${post.slug}`,
				description: post.description,
				published: post.published_at ?? post.created_at,
				categories: post.tags,
				image: post.image_url
					? { url: post.image_url, type: imageMimeType(post.image_url) }
					: null,
			})),
		}),
	);
}
