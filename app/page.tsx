import Image from "next/image";
import Link from "next/link";
import { formatDate, PostCard } from "@/components/PostCard";
import { getPublishedPosts } from "@/lib/posts";

export const revalidate = 60;

export default async function HomePage() {
	const posts = await getPublishedPosts(9);
	const [featured, ...remainingPosts] = posts;
	const secondaryPosts = remainingPosts.slice(0, 2);
	const regularPosts = remainingPosts.slice(2);

	return (
		<>
			<section
				className="hero"
				style={{
					["--hero-background" as string]: "url(/images/lightningbackground.jpg)",
				}}
			>
				<div className="container hero-inner">
					<p className="eyebrow">ΜΕΤΕΩΡΟΛΟΓΙΑ · ΕΛΛΑΔΑ</p>
					<h1>Ο καιρός της Ελλάδας, με έμφαση την Αττική.</h1>
					<p className="hero-copy">
						Αναλύσεις, προγνώσεις και μετεωρολογικά άρθρα, με έμφαση στα καιρικά φαινόμενα που
						επηρεάζουν τη χώρα.
					</p>
				</div>
			</section>

			<section className="section">
				<div className="container">
					<div className="section-heading">
						<h2>Τελευταία άρθρα</h2>
						<Link className="text-link" href="/posts">
							Όλα τα άρθρα
						</Link>
					</div>

					{featured ? (
						<>
							<Link className="featured-main" href={`/posts/${featured.slug}`}>
								{featured.image_url && (
									<Image
										src={featured.image_url}
										alt={featured.image_alt || featured.title}
										width={1200}
										height={675}
									/>
								)}
								<div className="featured-main-content">
									<p className="post-meta">{formatDate(featured.published_at)}</p>

									{featured.tags?.length > 0 && (
										<div className="post-tags">
											{featured.tags.map((tag) => (
												<span key={tag}>{tag}</span>
											))}
										</div>
									)}

									<h2>{featured.title}</h2>

									{featured.description && (
										<p className="featured-main-description">{featured.description}</p>
									)}
								</div>
							</Link>

							{secondaryPosts.length > 0 && (
								<div className="featured-secondary-grid">
									{secondaryPosts.map((post) => (
										<Link
											key={post.id}
											className="featured-secondary"
											href={`/posts/${post.slug}`}
										>
											{post.image_url && (
												<Image
													src={post.image_url}
													alt={post.image_alt || post.title}
													width={1200}
													height={675}
												/>
											)}

											<div className="featured-secondary-content">
												<p className="post-meta">{formatDate(post.published_at)}</p>

												{post.tags?.length > 0 && (
													<div className="post-tags">
														{post.tags.map((tag) => (
															<span key={tag}>{tag}</span>
														))}
													</div>
												)}

												<h3>{post.title}</h3>

												{post.description && <p>{post.description}</p>}
											</div>
										</Link>
									))}
								</div>
							)}

							{regularPosts.length > 0 && (
								<div className="post-grid homepage-post-grid">
									{regularPosts.map((post) => (
										<PostCard key={post.id} post={post} />
									))}
								</div>
							)}
						</>
					) : (
						<p>Δεν υπάρχουν ακόμη άρθρα.</p>
					)}
				</div>
			</section>
		</>
	);
}
