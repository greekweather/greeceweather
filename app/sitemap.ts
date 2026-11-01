import type { MetadataRoute } from "next";
import { getPublishedOutlooks } from "@/lib/outlooks";
import { getPublishedPosts } from "@/lib/posts";
import { SITE_URL } from "@/lib/site";

const siteUrl = SITE_URL;

export const revalidate = 600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const posts = await getPublishedPosts();
	const outlooks = await getPublishedOutlooks();

	const latest = [posts[0]?.updated_at, outlooks[0]?.updated_at]
		.filter((value): value is string => Boolean(value))
		.sort()
		.at(-1);

	return [
		{
			url: siteUrl,
			lastModified: latest ? new Date(latest) : new Date(),
			changeFrequency: "daily",
			priority: 1,
		},
		{
			url: `${siteUrl}/posts`,
			lastModified: posts[0]?.updated_at ? new Date(posts[0].updated_at) : new Date(),
			changeFrequency: "daily",
			priority: 0.9,
		},
		{
			url: `${siteUrl}/outlooks`,
			lastModified: outlooks[0] ? new Date(outlooks[0].updated_at) : new Date(),
			changeFrequency: "daily" as const,
			priority: 0.8,
		},
		...outlooks.map((outlook) => ({
			url: `${siteUrl}/outlooks/${outlook.slug}`,
			lastModified: new Date(outlook.updated_at),
			changeFrequency: "weekly" as const,
			priority: 0.6,
		})),
		...posts.map((post) => ({
			url: `${siteUrl}/posts/${post.slug}`,
			lastModified: new Date(post.updated_at || post.published_at || post.created_at),
			changeFrequency: "weekly" as const,
			priority: 0.8,
			...(post.image_url ? { images: [post.image_url] } : {}),
		})),
	];
}
