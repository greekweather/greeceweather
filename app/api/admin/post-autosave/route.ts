import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store" };

const bodySchema = z.object({
	id: z.string().uuid().nullable().optional(),
	title: z.string().max(180),
	slug: z.string().max(120),
	description: z.string().max(400),
	content: z.string().max(500_000),
	image_url: z.string().max(2000),
	image_alt: z.string().max(180),
	image_caption: z.string().max(300),
	tag_ids: z.array(z.string().uuid()).max(50),
});

function draftSlug() {
	return `draft-${crypto.randomUUID().slice(0, 8)}`;
}

// Saves a work in progress as an UNPUBLISHED post, so a closed tab or a tap on "back"
// does not lose it. It never touches a published post and never publishes anything.
export async function POST(request: Request) {
	const origin = request.headers.get("origin");

	if (origin && new URL(origin).host !== request.headers.get("host")) {
		return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
	}

	if (!(await isAdminSession())) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
	}

	let parsed: z.infer<typeof bodySchema>;

	try {
		parsed = bodySchema.parse(await request.json());
	} catch {
		return NextResponse.json({ error: "invalid" }, { status: 400, headers });
	}

	const supabase = await createClient();
	const slugOk = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(parsed.slug.trim());
	const imageOk = /^(https:\/\/|\/)/.test(parsed.image_url.trim());

	const fields = {
		title: parsed.title.trim(),
		description: parsed.description.trim(),
		content: parsed.content,
		image_url: imageOk ? parsed.image_url.trim() : null,
		image_alt: parsed.image_alt.trim(),
		image_caption: parsed.image_caption.trim(),
	};

	let id = parsed.id ?? null;

	if (id) {
		const { data: existing } = await supabase
			.from("posts")
			.select("published,slug")
			.eq("id", id)
			.single();

		if (!existing || existing.published) {
			return NextResponse.json({ error: "not-a-draft" }, { status: 409, headers });
		}

		const wanted = slugOk ? parsed.slug.trim() : existing.slug;
		let { error } = await supabase
			.from("posts")
			.update({ ...fields, slug: wanted })
			.eq("id", id);

		if (error && wanted !== existing.slug) {
			// the typed slug is probably taken by another post: keep the old one for now
			({ error } = await supabase
				.from("posts")
				.update({ ...fields, slug: existing.slug })
				.eq("id", id));
		}

		if (error) return NextResponse.json({ error: "db" }, { status: 500, headers });
	} else {
		let slug = slugOk ? parsed.slug.trim() : draftSlug();
		let result = await supabase
			.from("posts")
			.insert({ ...fields, slug, published: false, published_at: null })
			.select("id")
			.single();

		if (result.error && slug !== "") {
			slug = draftSlug();
			result = await supabase
				.from("posts")
				.insert({ ...fields, slug, published: false, published_at: null })
				.select("id")
				.single();
		}

		if (result.error || !result.data) {
			return NextResponse.json({ error: "db" }, { status: 500, headers });
		}

		id = result.data.id as string;
	}

	await supabase.from("post_tags").delete().eq("post_id", id);

	if (parsed.tag_ids.length > 0) {
		await supabase
			.from("post_tags")
			.insert(parsed.tag_ids.map((tagId) => ({ post_id: id, tag_id: tagId })));
	}

	return NextResponse.json({ id, savedAt: new Date().toISOString() }, { headers });
}
