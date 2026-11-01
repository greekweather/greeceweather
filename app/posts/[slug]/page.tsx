import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminEditLink } from "@/components/AdminEditLink";
import { ImageLightbox } from "@/components/ImageLightbox";
import { JsonLd } from "@/components/JsonLd";
import { Markdown } from "@/components/Markdown";
import { formatDate } from "@/components/PostCard";
import { ViewCounter } from "@/components/ViewCounter";
import { getPublishedPostBySlug } from "@/lib/posts";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { plainText } from "@/lib/text";

export const revalidate = 60;

export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: string }>;
}): Promise<Metadata> {
	const { slug } = await params;
	const post = await getPublishedPostBySlug(slug);

	if (!post) return {};

	return {
		title: `${post.title} · GreeceWeather`,
		description: post.description,
		openGraph: {
			title: post.title,
			description: post.description,
			type: "article",
			siteName: "GreeceWeather",
			locale: "el_GR",
			url: `/posts/${post.slug}`,
			publishedTime: post.published_at ?? undefined,
			modifiedTime: post.updated_at,
			tags: post.tags,
		},
		twitter: { card: "summary_large_image", title: post.title, description: post.description },
		alternates: { canonical: `/posts/${post.slug}` },
	};
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	const post = await getPublishedPostBySlug(slug);
	if (!post) notFound();
	const url = `${SITE_URL}/posts/${post.slug}`;

	return (
		<article className="article">
			<JsonLd
				data={{
					"@context": "https://schema.org",
					"@graph": [
						{
							"@type": "NewsArticle",
							"@id": `${url}#article`,
							mainEntityOfPage: url,
							url,
							headline: post.title.slice(0, 110),
							description: post.description || plainText(post.content, 200),
							image: [post.image_url ?? `${url}/opengraph-image`],
							datePublished: post.published_at,
							dateModified: post.updated_at || post.published_at,
							inLanguage: "el-GR",
							articleSection: post.tags[0],
							keywords: post.tags.join(", ") || undefined,
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
								{ "@type": "ListItem", position: 2, name: "Άρθρα", item: `${SITE_URL}/posts` },
								{ "@type": "ListItem", position: 3, name: post.title, item: url },
							],
						},
					],
				}}
			/>
			<ViewCounter slug={post.slug} />
			<div className="container article-container">
				<header className="article-header">
					<Link className="back-link" href="/">
						← Πίσω στην αρχική
					</Link>
					<p className="post-meta">{formatDate(post.published_at)}</p>
					<h1>{post.title}</h1>
					{post.description && <p className="article-lead">{post.description}</p>}
				</header>
				{post.image_url && (
					<figure className="article-hero">
						<Image
							src={post.image_url}
							alt={post.image_alt || post.title}
							width={1200}
							height={675}
							loading="eager"
							sizes="(max-width: 900px) 100vw, 900px"
							data-full={post.image_url}
						/>
						{post.image_caption && <figcaption>{post.image_caption}</figcaption>}
					</figure>
				)}
				<div className="article-body">
					<Markdown content={post.content} />
				</div>
				<ImageLightbox />
				{post.tags.length > 0 && (
					<footer className="article-footer">
						<span>Ετικέτες:</span>
						{post.tags.map((tag) => (
							<span key={tag} className="post-tag">
								{tag}
							</span>
						))}
					</footer>
				)}

				<AdminEditLink postId={post.id} />
			</div>
		</article>
	);
}
