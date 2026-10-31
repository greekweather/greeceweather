import { notFound } from "next/navigation";
import { updatePostAction } from "@/app/actions";
import { PostForm } from "@/components/admin/PostForm";
import { createClient } from "@/lib/supabase/server";
import { isLive } from "@/lib/visibility";

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;

	const supabase = await createClient();

	const [{ data, error }, { data: availableTags, error: tagsError }] = await Promise.all([
		supabase
			.from("posts")
			.select(`
					id,
					title,
					slug,
					description,
					content,
					image_url,
					image_alt,
					image_caption,
					published,
					published_at,
					post_tags (
						tag_id
					)
				`)
			.eq("id", id)
			.single(),

		supabase.from("tags").select("id,name").order("name", { ascending: true }),
	]);

	if (error || !data) {
		notFound();
	}

	if (tagsError) {
		throw new Error(tagsError.message);
	}

	const tagIds = (data.post_tags ?? []).map((item) => item.tag_id);

	const publishedAt = data.published_at
		? new Intl.DateTimeFormat("en-CA", {
				timeZone: "Europe/Athens",
				year: "numeric",
				month: "2-digit",
				day: "2-digit",
				hour: "2-digit",
				minute: "2-digit",
				hour12: false,
			})
				.formatToParts(new Date(data.published_at))
				.reduce<Record<string, string>>((result, part) => {
					if (part.type !== "literal") {
						result[part.type] = part.value;
					}
					return result;
				}, {})
		: null;

	const publishedAtValue = publishedAt
		? `${publishedAt.year}-${publishedAt.month}-${publishedAt.day}T${publishedAt.hour}:${publishedAt.minute}`
		: "";

	return (
		<section className="section">
			<div className="container">
				<div className="section-heading admin-heading-row">
					<h2>Επεξεργασία άρθρου</h2>

					{isLive(data.published, data.published_at) ? (
						<a
							className="button secondary"
							href={`/posts/${data.slug}`}
							target="_blank"
							rel="noopener noreferrer"
						>
							Προβολή στο site ↗
						</a>
					) : (
						<span className="admin-view-hint">
							Δεν είναι ακόμα ορατό στο site (πρόχειρο ή προγραμματισμένο).
						</span>
					)}
				</div>

				<PostForm
					post={{
						id: data.id,
						title: data.title,
						slug: data.slug,
						description: data.description,
						content: data.content,
						image_url: data.image_url ?? "",
						image_alt: data.image_alt,
						image_caption: data.image_caption ?? "",
						tag_ids: tagIds,
						published: data.published,
						published_at: publishedAtValue,
					}}
					action={updatePostAction}
					availableTags={availableTags ?? []}
				/>
			</div>
		</section>
	);
}
