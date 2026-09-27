import { PostCard } from "@/components/PostCard";
import { PostsFilter } from "@/components/PostsFilter";
import { getPublishedPosts } from "@/lib/posts";

export const revalidate = 60;

export default async function PostsPage() {
	const posts = await getPublishedPosts();
	const tags = Array.from(new Set(posts.flatMap((p) => p.tags))).sort((a, b) =>
		a.localeCompare(b, "el"),
	);
	return (
		<>
			<section className="page-header">
				<div className="container">
					<p className="eyebrow">ΑΡΧΕΙΟ</p>
					<h1>Άρθρα</h1>
					<p>Όλα τα δημοσιευμένα άρθρα.</p>
				</div>
			</section>
			<section className="section">
				<div className="container">
					<PostsFilter tags={tags} />
					<div className="post-grid" id="articles-grid">
						{posts.map((post) => (
							<div
								key={post.id}
								data-title={post.title || "-"}
								data-tags={post.tags.map((t) => t.toLocaleLowerCase("el-GR")).join("|")}
								data-date={post.published_at ? Date.parse(post.published_at) : 0}
								data-views={post.views}
							>
								<PostCard post={post} />
							</div>
						))}
					</div>
					{!posts.length && <p>Δεν υπάρχουν ακόμη άρθρα.</p>}
				</div>
			</section>
		</>
	);
}
