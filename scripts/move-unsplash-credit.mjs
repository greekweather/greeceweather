// Moves the "Φωτογραφία από Unsplash" line out of every post's content and into
// posts.image_caption (plain text, no markdown).
//
//   node --env-file=.env.local scripts/move-unsplash-credit.mjs          # dry run (prints only)
//   node --env-file=.env.local scripts/move-unsplash-credit.mjs --apply  # writes to the database
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the env file.
// Run it locally only; the service key must never reach the browser or the repo.
// Safe to re-run: posts without the sentence are skipped, and an existing caption is kept.

import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const MARKER = /Φωτογραφία\s+από\s+Unsplash/i;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
	console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
	process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

function stripMarkdown(text) {
	return text
		.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1") // images
		.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links -> their text
		.replace(/<[^>]+>/g, "") // html tags
		.replace(/^\s{0,3}(?:#{1,6}\s+|>\s?|[-*+]\s+)/, "") // heading / quote / list marker
		.replace(/(\*\*|__|\*|_|~~|`)/g, "") // emphasis, code
		.replace(/\\([\\`*_{}[\]()#+\-.!])/g, "$1") // escapes
		.replace(/\s+/g, " ")
		.trim();
}

function split(content) {
	const lines = content.replace(/\r\n/g, "\n").split("\n");
	const index = lines.findIndex((line) => MARKER.test(line));

	if (index === -1) return null;

	const caption = stripMarkdown(lines[index]);
	lines.splice(index, 1);

	const cleaned = lines
		.map((line) => line.replace(/[ \t]+$/, "")) // trailing spaces
		.join("\n")
		.replace(/\n{3,}/g, "\n\n") // gap left behind (and any other 3+ blank lines)
		.trim();

	return { caption, content: cleaned };
}

const { data: posts, error } = await db
	.from("posts")
	.select("id, slug, content, image_caption")
	.ilike("content", "%Unsplash%");

if (error) {
	console.error(error.message);
	process.exit(1);
}

let changed = 0;

for (const post of posts) {
	const result = split(post.content ?? "");

	if (!result) continue;

	const caption = post.image_caption?.trim() ? post.image_caption : result.caption.slice(0, 300);

	console.log(`${APPLY ? "UPDATE" : "would update"}  ${post.slug}\n    caption: ${caption}`);

	if (post.image_caption?.trim()) {
		console.log("    (existing caption kept; the Unsplash line is still removed from the text)");
	}

	if (APPLY) {
		const { error: updateError } = await db
			.from("posts")
			.update({ content: result.content, image_caption: caption })
			.eq("id", post.id);

		if (updateError) {
			console.error(`    FAILED: ${updateError.message}`);
			continue;
		}
	}

	changed++;
}

console.log(
	`\n${changed} post(s) ${APPLY ? "updated" : "would be updated (dry run, add --apply)"}.`,
);
