import Image from "next/image";
import type { PostSummary } from "@/lib/posts";

export function PostCard({ post }: { post: PostSummary }) {
	return (
		<article className="post-card">
			<a
				className="post-image-link"
				href={`/posts/${post.slug}`}
				aria-label={`Ανάγνωση του άρθρου: ${post.title}`}
			>
				{post.image_url ? (
					<Image
						className="post-image"
						src={post.image_url}
						alt=""
						width={700}
						height={394}
						sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw"
					/>
				) : (
					<div className="post-image post-image-placeholder" aria-hidden="true">
						<span>Χωρίς εικόνα</span>
					</div>
				)}
			</a>
			<div className="post-card-body">
				<div className="post-meta">{formatDate(post.published_at)}</div>
				<h3>
					<a href={`/posts/${post.slug}`}>{post.title}</a>
				</h3>
				<p>{post.description}</p>

				<div className="post-card-footer">
					<div className="post-tags">
						{post.tags.length > 0 &&
							post.tags.map((tag) => (
								<span className="post-tag" key={tag}>
									{tag}
								</span>
							))}
					</div>

					<a className="text-link" href={`/posts/${post.slug}`}>
						Διαβάστε το άρθρο <span aria-hidden="true">→</span>
					</a>
				</div>
			</div>
		</article>
	);
}

export function formatDate(value: string | null) {
	if (!value) return "";
	return new Intl.DateTimeFormat("el-GR", {
		timeZone: "Europe/Athens",
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	}).format(new Date(value));
}
