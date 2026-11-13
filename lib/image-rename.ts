import { refreshAfterImageRenameAction } from "@/app/actions";
import { renameIndexed } from "@/lib/image-hash";
import { IMAGE_BUCKET } from "@/lib/image-upload";
import { storageFileBase } from "@/lib/slug";
import { createClient } from "@/lib/supabase/client";

type PostRow = { id: string; slug: string; image_url: string | null; content: string };

export type RenameResult = { name: string; url: string; postsUpdated: number };

const escapeLike = (text: string) => text.replace(/[\\%_]/g, (char) => `\\${char}`);

/**
 * Renames an image in the library and rewrites every post that uses it (cover image and the
 * links inside the text), so nothing breaks. Throws with a readable message on failure; if
 * the posts cannot be updated the file is moved back.
 */
export async function renameImage(oldName: string, typed: string): Promise<RenameResult> {
	const supabase = createClient();
	const extension = /\.[a-z0-9]{2,5}$/i.exec(oldName)?.[0] ?? ".webp";
	const withoutExtension = typed.trim().replace(/\.[a-z0-9]{2,5}$/i, "");
	const newName = `${storageFileBase(withoutExtension)}${extension}`;

	if (!withoutExtension) throw new Error("Γράψε ένα όνομα.");
	if (newName === oldName) throw new Error("Το όνομα είναι το ίδιο.");

	const bucket = supabase.storage.from(IMAGE_BUCKET);
	const oldUrl = bucket.getPublicUrl(oldName).data.publicUrl;
	const newUrl = bucket.getPublicUrl(newName).data.publicUrl;

	const { data: taken } = await bucket.list("", { limit: 100, search: newName });

	if ((taken ?? []).some((item) => item.name === newName)) {
		throw new Error(`Υπάρχει ήδη εικόνα με το όνομα «${newName}».`);
	}

	const { error: moveError } = await bucket.move(oldName, newName);

	if (moveError) throw new Error(`Η μετονομασία απέτυχε: ${moveError.message}`);

	const changed: PostRow[] = [];

	try {
		const [byCover, byText] = await Promise.all([
			supabase.from("posts").select("id,slug,image_url,content").eq("image_url", oldUrl),
			supabase
				.from("posts")
				.select("id,slug,image_url,content")
				.ilike("content", `%${escapeLike(oldUrl)}%`),
		]);

		if (byCover.error) throw byCover.error;
		if (byText.error) throw byText.error;

		const posts = new Map<string, PostRow>();

		for (const post of [...(byCover.data ?? []), ...(byText.data ?? [])]) {
			posts.set(String(post.id), post);
		}

		for (const post of posts.values()) {
			const { error } = await supabase
				.from("posts")
				.update({
					image_url: post.image_url ? post.image_url.split(oldUrl).join(newUrl) : null,
					content: (post.content ?? "").split(oldUrl).join(newUrl),
				})
				.eq("id", post.id);

			if (error) throw error;

			changed.push(post);
		}

		await renameIndexed(oldUrl, newUrl);

		try {
			await refreshAfterImageRenameAction([...posts.values()].map((post) => post.slug));
		} catch {}

		return { name: newName, url: newUrl, postsUpdated: posts.size };
	} catch (error) {
		// put everything back as it was
		for (const post of changed) {
			await supabase
				.from("posts")
				.update({ image_url: post.image_url, content: post.content })
				.eq("id", post.id);
		}

		await bucket.move(newName, oldName);

		throw new Error(
			`Οι σύνδεσμοι στα άρθρα δεν ενημερώθηκαν, η εικόνα κράτησε το παλιό της όνομα (${
				error instanceof Error ? error.message : "άγνωστο σφάλμα"
			}).`,
		);
	}
}
