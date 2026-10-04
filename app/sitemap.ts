import type { MetadataRoute } from "next";
import { getPublishedPosts } from "@/lib/posts";

const siteUrl = "https://www.greeceweather.gr";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const posts = await getPublishedPosts();

	return [
		{
			url: siteUrl,
			lastModified: new Date(),
			changeFrequency: "daily",
			priority: 1,
		},
		{
			url: `${siteUrl}/posts`,
			lastModified: posts[0]?.updated_at
				? new Date(posts[0].updated_at)
				: new Date(),
			changeFrequency: "daily",
			priority: 0.9,
		},
		...posts.map((post) => ({
			url: `${siteUrl}/posts/${post.slug}`,
			lastModified: new Date(post.updated_at || post.published_at || post.created_at),
			changeFrequency: "weekly" as const,
			priority: 0.8,
		})),
	];
}
