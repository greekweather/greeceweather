import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";

export type Post = {
	id: string;
	title: string;
	slug: string;
	description: string;
	content: string;
	image_url: string | null;
	image_alt: string;
	image_caption: string;
	tags: string[];
	published: boolean;
	published_at: string | null;
	views: number;
	created_at: string;
	updated_at: string;
};

// What list pages (home, archive, sitemap) need: everything except the article text.
export type PostSummary = Omit<Post, "content" | "image_caption">;

type TagRef = { name: string };

type PostTagRow = {
	tag_id: string;
	tags: TagRef | TagRef[] | null;
};

function tagNames(rows: PostTagRow[] | null | undefined): string[] {
	return (rows ?? [])
		.flatMap((row) => (Array.isArray(row.tags) ? row.tags : row.tags ? [row.tags] : []))
		.map((tag) => tag.name)
		.filter((name): name is string => Boolean(name))
		.sort((a, b) => a.localeCompare(b, "el"));
}

const SUMMARY_COLUMNS = `
	id,
	title,
	slug,
	description,
	image_url,
	image_alt,
	published,
	published_at,
	views,
	created_at,
	updated_at,
	post_tags (
		tag_id,
		tags (
			name
		)
	)
`;

type SummaryRow = Omit<PostSummary, "tags"> & { post_tags: PostTagRow[] | null };
type PostRow = SummaryRow & { content: string; image_caption: string };

export async function getPublishedPosts(limit?: number): Promise<PostSummary[]> {
	const supabase = createPublicClient();

	let query = supabase
		.from("posts")
		.select(SUMMARY_COLUMNS)
		.eq("published", true)
		.not("published_at", "is", null)
		.lte("published_at", new Date().toISOString())
		.order("published_at", { ascending: false });

	if (limit) {
		query = query.limit(limit);
	}

	const { data, error } = await query;

	if (error) {
		throw new Error("Δεν ήταν δυνατή η φόρτωση των άρθρων.");
	}

	return ((data ?? []) as unknown as SummaryRow[]).map(({ post_tags, ...post }) => ({
		...post,
		tags: tagNames(post_tags),
	}));
}

// cache() lets generateMetadata and the page share one query per request.
export const getPublishedPostBySlug = cache(async (slug: string): Promise<Post | null> => {
	const supabase = createPublicClient();

	const { data, error } = await supabase
		.from("posts")
		.select(`${SUMMARY_COLUMNS}, content, image_caption`)
		.eq("slug", slug)
		.eq("published", true)
		.not("published_at", "is", null)
		.lte("published_at", new Date().toISOString())
		.maybeSingle();

	if (error) {
		throw new Error("Δεν ήταν δυνατή η φόρτωση του άρθρου.");
	}

	if (!data) {
		return null;
	}

	const { post_tags, ...post } = data as unknown as PostRow;

	return { ...post, tags: tagNames(post_tags) };
});
