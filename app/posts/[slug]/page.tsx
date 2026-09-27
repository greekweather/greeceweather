import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/Markdown";
import { formatDate } from "@/components/PostCard";
import { ViewCounter } from "@/components/ViewCounter";
import { getPublishedPostBySlug } from "@/lib/posts";

export const dynamic = "force-dynamic";

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
			images: post.image_url ? [post.image_url] : [],
		},
	};
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	const post = await getPublishedPostBySlug(slug);
	if (!post) notFound();
	return (
		<article className="article">
			<ViewCounter slug={post.slug} />
			<div className="container article-container">
				<header className="article-header">
					<a className="back-link" href="/posts">
						← Όλα τα άρθρα
					</a>
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
						/>
					</figure>
				)}
				<div className="article-body">
					<Markdown content={post.content} />
				</div>
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
			</div>
		</article>
	);
}
