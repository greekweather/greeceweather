#!/usr/bin/env node
// Looks at every image in the "post-images" bucket with Claude and renames it after what it
// shows ("polar-vortex-chart", "enso-explained", "thunderstorm", "raindrops"...). Posts that
// use the image (main picture and pictures inside the text) are updated to the new address.
//
//   node --env-file=.env.local scripts/rename-images-ai.mjs            # preview only
//   node --env-file=.env.local scripts/rename-images-ai.mjs --apply    # really rename
//
// Options
//   --all          rename every image (default: only generic names such as UUIDs, IMG_1234,
//                  Screenshot..., 1699999999-photo)
//   --limit=N      look at no more than N images
//   --model=NAME   Claude model (default claude-haiku-5-5)
//   --undo=FILE    put everything back using a log written by an earlier --apply
//
// Needs in the environment: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and
// ANTHROPIC_API_KEY. Every --apply writes rename-images-log.json (old name -> new name);
// keep it, it is what --undo reads.
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const BUCKET = "post-images";
const EXTENSIONS = {
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	webp: "image/webp",
	gif: "image/gif",
};
const MAX_BYTES = 4_500_000;
const LOG_FILE = "rename-images-log.json";

// ---------- pure helpers (also used by the tests) ----------

export function isGenericName(fileName) {
	const base = fileName.replace(/\.[^.]+$/, "").toLowerCase();

	return (
		/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(base) ||
		/^(img|dsc|dscn|pxl|image|photo|screenshot|screen-shot|download|unnamed|untitled|whatsapp-image|fb_img|received)[-_ ]?[0-9a-z_.\- ()]*$/.test(
			base,
		) ||
		/^[0-9]{8,}([-_].*)?$/.test(base) ||
		/^[0-9]+-[0-9a-f]{4,8}-/.test(base)
	);
}

export function cleanName(raw) {
	return String(raw ?? "")
		.toLowerCase()
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.split("-")
		.slice(0, 7)
		.join("-")
		.slice(0, 56)
		.replace(/-+$/g, "");
}

// A name nobody uses yet: "storm", then "storm-2", "storm-3"...
export function uniqueName(base, folder, ext, taken) {
	for (let n = 1; n < 1000; n += 1) {
		const candidate = `${folder}${n === 1 ? base : `${base}-${n}`}.${ext}`;

		if (!taken.has(candidate.toLowerCase())) return candidate;
	}

	throw new Error(`no free name for ${base}`);
}

// Replaces old addresses by new ones inside a text; returns [text, count].
export function replaceUrls(text, pairs) {
	let out = text;
	let count = 0;

	for (const [from, to] of pairs) {
		const parts = out.split(from);

		if (parts.length > 1) {
			count += parts.length - 1;
			out = parts.join(to);
		}
	}

	return [out, count];
}

// ---------- the real work ----------

function arg(name) {
	const hit = process.argv.find((item) => item === `--${name}` || item.startsWith(`--${name}=`));

	if (!hit) return undefined;

	return hit.includes("=") ? hit.slice(hit.indexOf("=") + 1) : true;
}

function need(name) {
	const value = process.env[name];

	if (!value) {
		console.error(
			`Λείπει η μεταβλητή ${name}. Τρέξε με: node --env-file=.env.local scripts/rename-images-ai.mjs`,
		);
		process.exit(1);
	}

	return value;
}

async function listAll(supabase, path = "") {
	const out = [];
	const { data, error } = await supabase.storage.from(BUCKET).list(path, { limit: 1000 });

	if (error) throw new Error(error.message);

	for (const item of data ?? []) {
		const full = path ? `${path}/${item.name}` : item.name;

		if (item.id) out.push(full);
		else out.push(...(await listAll(supabase, full)));
	}

	return out;
}

export async function askClaude({ apiKey, baseUrl, model, bytes, mediaType, hint }) {
	const prompt = [
		"This image belongs to a Greek weather website (forecasts, weather models like GFS/ECMWF, satellite and radar images, charts, climate topics such as ENSO or the polar vortex, photos of weather phenomena).",
		"Give it a short, specific FILE NAME in English: 2 to 5 lowercase words that say what the image shows, e.g. polar-vortex-chart, enso-explained, thunderstorm-over-sea, raindrops-on-window, gfs-precipitation-map.",
		"Prefer the topic over the look (not 'blue-image'). No dates, no numbers unless they are part of the topic, no file extension.",
		hint ? `Context (may help, may be wrong): ${hint}` : "",
		'Reply with JSON only: {"name":"..."}',
	]
		.filter(Boolean)
		.join("\n");

	for (let attempt = 1; attempt <= 4; attempt += 1) {
		const response = await fetch(`${baseUrl}/v1/messages`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-api-key": apiKey,
				"anthropic-version": "2023-06-01",
			},
			body: JSON.stringify({
				model,
				max_tokens: 100,
				messages: [
					{
						role: "user",
						content: [
							{
								type: "image",
								source: { type: "base64", media_type: mediaType, data: bytes.toString("base64") },
							},
							{ type: "text", text: prompt },
						],
					},
				],
			}),
		});

		if (response.status === 429 || response.status >= 500) {
			await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
			continue;
		}

		if (!response.ok)
			throw new Error(`Anthropic ${response.status}: ${(await response.text()).slice(0, 200)}`);

		const data = await response.json();
		const text = (data.content ?? []).map((part) => part.text ?? "").join("");
		const json = text.match(/\{[\s\S]*\}/);

		return cleanName(json ? JSON.parse(json[0]).name : text);
	}

	throw new Error("Anthropic: too many retries");
}

async function updateReferences(supabase, pairs) {
	const { data: posts, error } = await supabase.from("posts").select("id,title,image_url,content");

	if (error) throw new Error(error.message);

	let changed = 0;

	for (const post of posts ?? []) {
		const [image] = replaceUrls(post.image_url ?? "", pairs);
		const [content] = replaceUrls(post.content ?? "", pairs);

		if (image === (post.image_url ?? "") && content === (post.content ?? "")) continue;

		const { error: updateError } = await supabase
			.from("posts")
			.update({ image_url: post.image_url ? image : null, content })
			.eq("id", post.id);

		if (updateError) throw new Error(`post ${post.id}: ${updateError.message}`);

		changed += 1;
	}

	return changed;
}

async function movePairs(supabase, moves, urlOf) {
	const done = [];

	for (const [from, to] of moves) {
		const { error } = await supabase.storage.from(BUCKET).move(from, to);

		if (error) {
			console.error(`  ✗ ${from} → ${to}: ${error.message}`);
			continue;
		}

		done.push([from, to]);
	}

	const changed = await updateReferences(
		supabase,
		done.map(([from, to]) => [urlOf(from), urlOf(to)]),
	);

	return { done, changed };
}

async function main() {
	const { createClient } = await import("@supabase/supabase-js");
	const supabase = createClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL ?? need("SUPABASE_URL"),
		need("SUPABASE_SERVICE_ROLE_KEY"),
		{ auth: { persistSession: false } },
	);
	const urlOf = (path) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

	const undo = arg("undo");

	if (undo) {
		const log = JSON.parse(readFileSync(undo === true ? LOG_FILE : undo, "utf8"));
		const { done, changed } = await movePairs(
			supabase,
			log.moves.map(({ from, to }) => [to, from]),
			urlOf,
		);

		console.log(`Επαναφέρθηκαν ${done.length} εικόνες, ενημερώθηκαν ${changed} άρθρα.`);
		return;
	}

	const apply = arg("apply") === true;
	const all = arg("all") === true;
	const limit = Number(arg("limit") ?? Number.POSITIVE_INFINITY);
	const model = typeof arg("model") === "string" ? arg("model") : "claude-haiku-5-5";
	const apiKey = need("ANTHROPIC_API_KEY");
	const baseUrl = process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com";

	const paths = await listAll(supabase);
	const taken = new Set(paths.map((path) => path.toLowerCase()));
	const { data: posts } = await supabase.from("posts").select("title,image_url,content");

	const titlesFor = (path) => {
		const url = urlOf(path);

		return (posts ?? [])
			.filter((post) => post.image_url === url || (post.content ?? "").includes(url))
			.map((post) => post.title)
			.slice(0, 2)
			.join(" | ");
	};

	const candidates = paths
		.filter((path) => EXTENSIONS[path.split(".").pop()?.toLowerCase() ?? ""])
		.filter((path) => all || isGenericName(path.split("/").pop() ?? path))
		.slice(0, limit);

	console.log(
		`${paths.length} αρχεία στο bucket, ${candidates.length} προς ονομασία${all ? "" : " (μόνο γενικά ονόματα· --all για όλα)"}.${apply ? "" : " ΔΟΚΙΜΗ: δεν αλλάζει τίποτα (--apply για πραγματική αλλαγή)."}\n`,
	);

	const moves = [];

	for (const [index, path] of candidates.entries()) {
		const folder = path.includes("/") ? `${path.slice(0, path.lastIndexOf("/") + 1)}` : "";
		const ext = path.split(".").pop().toLowerCase();

		try {
			const response = await fetch(urlOf(path));

			if (!response.ok) throw new Error(`λήψη ${response.status}`);

			const bytes = Buffer.from(await response.arrayBuffer());

			if (bytes.length > MAX_BYTES) throw new Error("πολύ μεγάλο αρχείο (>4,5MB), το παρέλειψα");

			const name = await askClaude({
				apiKey,
				baseUrl,
				model,
				bytes,
				mediaType: EXTENSIONS[ext],
				hint: titlesFor(path),
			});

			if (!name) throw new Error("το μοντέλο δεν έδωσε όνομα");

			const target = uniqueName(name, folder, ext, taken);

			taken.add(target.toLowerCase());
			moves.push([path, target]);
			console.log(`[${index + 1}/${candidates.length}] ${path}\n      → ${target}`);
		} catch (error) {
			console.error(`[${index + 1}/${candidates.length}] ${path}: ${error.message}`);
		}
	}

	if (!apply) {
		console.log(`\n${moves.length} μετονομασίες έτοιμες. Τρέξε ξανά με --apply για να γίνουν.`);
		return;
	}

	const { done, changed } = await movePairs(supabase, moves, urlOf);

	writeFileSync(
		LOG_FILE,
		JSON.stringify(
			{ at: new Date().toISOString(), moves: done.map(([from, to]) => ({ from, to })) },
			null,
			2,
		),
	);
	console.log(
		`\nΜετονομάστηκαν ${done.length} εικόνες, ενημερώθηκαν ${changed} άρθρα. Log: ${LOG_FILE} (για επαναφορά: --undo)`,
	);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((error) => {
		console.error(error.message);
		process.exit(1);
	});
}
