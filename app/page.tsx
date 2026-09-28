import Link from "next/link";
import { PostCard } from "@/components/PostCard";
import { getPublishedPosts } from "@/lib/posts";

export const revalidate = 60;

export default async function HomePage() {
	const posts = await getPublishedPosts(6);
	return (
		<>
			<section
				className="hero"
				style={{ ["--hero-background" as string]: "url(/images/lightningbackground.jpg)" }}
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
					<div className="post-grid">
						{posts.length ? (
							posts.map((post) => <PostCard key={post.id} post={post} />)
						) : (
							<p>Δεν υπάρχουν ακόμη άρθρα.</p>
						)}
					</div>
				</div>
			</section>
		</>
	);
}
