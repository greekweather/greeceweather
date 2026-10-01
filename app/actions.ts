"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { athensLocalToUTC } from "@/lib/date";
import { createClient } from "@/lib/supabase/server";
import { postInputSchema } from "@/lib/validation";

function formDataToInput(formData: FormData) {
	return postInputSchema.parse({
		title: formData.get("title"),
		slug: formData.get("slug"),
		description: formData.get("description") ?? "",
		content: formData.get("content"),
		image_url: formData.get("image_url") ?? "",
		image_alt: formData.get("image_alt") ?? "",
		published: formData.get("published") === "on",
		published_at: formData.get("published_at") ?? "",
	});
}

function getTagIds(formData: FormData) {
	return Array.from(
		new Set(
			formData
				.getAll("tag_ids")
				.map((value) => String(value).trim())
				.filter(Boolean),
		),
	);
}

export async function createPostAction(formData: FormData) {
	await requireAdmin();

	const input = formDataToInput(formData);
	const tagIds = getTagIds(formData);

	if (input.published && tagIds.length === 0) {
		throw new Error("Για δημοσίευση απαιτείται τουλάχιστον μία ετικέτα.");
	}

	if (input.published && !input.image_url.trim()) {
		throw new Error("Για δημοσίευση απαιτείται εικόνα άρθρου.");
	}

	if (input.published && !input.slug.trim()) {
		throw new Error("Για δημοσίευση απαιτείται slug άρθρου.");
	}

	const supabase = await createClient();

	const publishedAt = input.published
		? input.published_at
			? athensLocalToUTC(input.published_at)
			: new Date().toISOString()
		: null;

	const { data, error } = await supabase
		.from("posts")
		.insert({
			title: input.title,
			slug: input.slug,
			description: input.description,
			content: input.content,
			image_url: input.image_url || null,
			image_alt: input.image_alt,
			published: input.published,
			published_at: publishedAt,
		})
		.select("id")
		.single();

	if (error) {
		throw new Error(error.message);
	}

	if (tagIds.length > 0) {
		const { error: tagError } = await supabase.from("post_tags").insert(
			tagIds.map((tagId) => ({
				post_id: data.id,
				tag_id: tagId,
			})),
		);

		if (tagError) {
			throw new Error(tagError.message);
		}
	}

	revalidatePath("/");
	revalidatePath("/posts");
	revalidatePath(`/posts/${input.slug}`);
	revalidatePath("/admin");
	revalidatePath("/admin/posts");
	revalidatePath("/admin/tags");

	redirect("/admin/posts");
}

export async function updatePostAction(formData: FormData) {
	await requireAdmin();

	const id = String(formData.get("id") ?? "");

	if (!id) {
		throw new Error("Μη έγκυρο άρθρο.");
	}

	const input = formDataToInput(formData);
	const tagIds = getTagIds(formData);

	if (input.published && tagIds.length === 0) {
		throw new Error("Για δημοσίευση απαιτείται τουλάχιστον μία ετικέτα.");
	}

	if (input.published && !input.image_url.trim()) {
		throw new Error("Για δημοσίευση απαιτείται εικόνα άρθρου.");
	}

	if (input.published && !input.slug.trim()) {
		throw new Error("Για δημοσίευση απαιτείται slug άρθρου.");
	}

	const supabase = await createClient();

	const publishedAt = input.published
		? input.published_at
			? athensLocalToUTC(input.published_at)
			: new Date().toISOString()
		: null;

	const { data: existingPost, error: existingPostError } = await supabase
		.from("posts")
		.select("slug")
		.eq("id", id)
		.single();

	if (existingPostError || !existingPost) {
		throw new Error(existingPostError?.message ?? "Το άρθρο δεν βρέθηκε.");
	}

	const { error } = await supabase
		.from("posts")
		.update({
			title: input.title,
			slug: input.slug,
			description: input.description,
			content: input.content,
			image_url: input.image_url || null,
			image_alt: input.image_alt,
			published: input.published,
			published_at: publishedAt,
		})
		.eq("id", id);

	if (error) {
		throw new Error(error.message);
	}

	const { error: deleteTagsError } = await supabase.from("post_tags").delete().eq("post_id", id);

	if (deleteTagsError) {
		throw new Error(deleteTagsError.message);
	}

	if (tagIds.length > 0) {
		const { error: insertTagsError } = await supabase.from("post_tags").insert(
			tagIds.map((tagId) => ({
				post_id: id,
				tag_id: tagId,
			})),
		);

		if (insertTagsError) {
			throw new Error(insertTagsError.message);
		}
	}

	revalidatePath("/");
	revalidatePath("/posts");
	revalidatePath(`/posts/${existingPost.slug}`);
	revalidatePath(`/posts/${input.slug}`);
	revalidatePath("/admin");
	revalidatePath("/admin/posts");
	revalidatePath("/admin/tags");

	redirect("/admin/posts");
}

export async function deletePostAction(formData: FormData) {
	await requireAdmin();

	const id = String(formData.get("id") ?? "");

	if (!id) {
		throw new Error("Μη έγκυρο άρθρο.");
	}

	const supabase = await createClient();

	const { data: post, error: fetchError } = await supabase
		.from("posts")
		.select("slug")
		.eq("id", id)
		.single();

	if (fetchError || !post) {
		throw new Error(fetchError?.message ?? "Το άρθρο δεν βρέθηκε.");
	}

	const { error } = await supabase.from("posts").delete().eq("id", id);

	if (error) {
		throw new Error(error.message);
	}

	revalidatePath("/");
	revalidatePath("/posts");
	revalidatePath(`/posts/${post.slug}`);
	revalidatePath("/admin");
	revalidatePath("/admin/posts");
	revalidatePath("/admin/tags");

	redirect("/admin/posts");
}

export async function createTagAction(formData: FormData) {
	await requireAdmin();

	const name = String(formData.get("name") ?? "").trim();

	if (!name) {
		throw new Error("Το όνομα της ετικέτας είναι υποχρεωτικό.");
	}

	if (name.length > 80) {
		throw new Error("Η ετικέτα μπορεί να έχει έως 80 χαρακτήρες.");
	}

	const supabase = await createClient();

	const hashBuffer = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(name.toLowerCase()),
	);

	const hash = Array.from(new Uint8Array(hashBuffer))
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("")
		.slice(0, 12);

	const slug = `tag-${hash}`;

	const { error } = await supabase.from("tags").insert({
		name,
		slug,
	});

	if (error) {
		if (error.code === "23505") {
			throw new Error("Υπάρχει ήδη ετικέτα με αυτό το όνομα.");
		}

		throw new Error(error.message);
	}

	revalidatePath("/admin/tags");
	revalidatePath("/admin/posts/new");

	redirect("/admin/tags");
}

export async function updateTagAction(formData: FormData) {
	await requireAdmin();

	const id = String(formData.get("id") ?? "");
	const name = String(formData.get("name") ?? "").trim();

	if (!id) {
		throw new Error("Μη έγκυρη ετικέτα.");
	}

	if (!name) {
		throw new Error("Το όνομα της ετικέτας είναι υποχρεωτικό.");
	}

	if (name.length > 80) {
		throw new Error("Η ετικέτα μπορεί να έχει έως 80 χαρακτήρες.");
	}

	const supabase = await createClient();

	const { error } = await supabase.from("tags").update({ name }).eq("id", id);

	if (error) {
		if (error.code === "23505") {
			throw new Error("Υπάρχει ήδη ετικέτα με αυτό το όνομα.");
		}

		throw new Error(error.message);
	}

	revalidatePath("/admin/tags");
	revalidatePath("/admin/posts");
	revalidatePath("/admin/posts/new");

	redirect("/admin/tags");
}

export async function deleteTagAction(formData: FormData) {
	await requireAdmin();

	const id = String(formData.get("id") ?? "");

	if (!id) {
		throw new Error("Μη έγκυρη ετικέτα.");
	}

	const supabase = await createClient();

	const { error } = await supabase.from("tags").delete().eq("id", id);

	if (error) {
		throw new Error(error.message);
	}

	revalidatePath("/admin/tags");
	revalidatePath("/admin/posts");
	revalidatePath("/posts");
	revalidatePath("/");

	redirect("/admin/tags");
}

export async function createBannerAction(_prevState: { error?: string }, formData: FormData) {
	await requireAdmin();

	const forecastEnabled = formData.get("forecast_enabled") === "on";
	const emergencyEnabled = formData.get("emergency_enabled") === "on";
	const updateEnabled = formData.get("update_enabled") === "on";

	const forecastUrl = String(formData.get("forecast_url") ?? "").trim();
	const emergencyUrl = String(formData.get("emergency_url") ?? "").trim();
	const updateUrl = String(formData.get("update_url") ?? "").trim();

	if (forecastEnabled && !forecastUrl) {
		return {
			error: "Το URL της πρόγνωσης είναι υποχρεωτικό.",
		};
	}

	if (emergencyEnabled && !emergencyUrl) {
		return {
			error: "Το URL του έκτακτου δελτίου είναι υποχρεωτικό.",
		};
	}

	if (updateEnabled && !updateUrl) {
		return {
			error: "Το URL της επικαιροποίησης είναι υποχρεωτικό.",
		};
	}

	if (!forecastEnabled && !emergencyEnabled && !updateEnabled) {
		return {
			error: "Πρέπει να ενεργοποιήσεις τουλάχιστον μία επιλογή.",
		};
	}

	const supabase = await createClient();

	const { error } = await supabase.from("weather_banner").insert({
		forecast_enabled: forecastEnabled,
		forecast_url: forecastUrl || null,
		emergency_enabled: emergencyEnabled,
		emergency_url: emergencyUrl || null,
		update_enabled: updateEnabled,
		update_url: updateUrl || null,
		updated_at: new Date().toISOString(),
	});

	if (error) {
		return {
			error: "Δεν ήταν δυνατή η αποθήκευση του μπάνερ.",
		};
	}

	revalidatePath("/");
	revalidatePath("/admin");
	revalidatePath("/admin/banner");

	redirect("/admin/banner");
}

export async function updateBannerAction(_prevState: { error?: string }, formData: FormData) {
	await requireAdmin();

	const id = String(formData.get("id") ?? "");

	if (!id) {
		return {
			error: "Μη έγκυρο μπάνερ.",
		};
	}

	const forecastEnabled = formData.get("forecast_enabled") === "on";
	const emergencyEnabled = formData.get("emergency_enabled") === "on";
	const updateEnabled = formData.get("update_enabled") === "on";

	const forecastUrl = String(formData.get("forecast_url") ?? "").trim();
	const emergencyUrl = String(formData.get("emergency_url") ?? "").trim();
	const updateUrl = String(formData.get("update_url") ?? "").trim();

	if (forecastEnabled && !forecastUrl) {
		return {
			error: "Το URL της πρόγνωσης είναι υποχρεωτικό.",
		};
	}

	if (emergencyEnabled && !emergencyUrl) {
		return {
			error: "Το URL του έκτακτου δελτίου είναι υποχρεωτικό.",
		};
	}

	if (updateEnabled && !updateUrl) {
		return {
			error: "Το URL της επικαιροποίησης είναι υποχρεωτικό.",
		};
	}

	if (!forecastEnabled && !emergencyEnabled && !updateEnabled) {
		return {
			error: "Πρέπει να ενεργοποιήσεις τουλάχιστον μία επιλογή.",
		};
	}

	const supabase = await createClient();

	const { error } = await supabase
		.from("weather_banner")
		.update({
			forecast_enabled: forecastEnabled,
			forecast_url: forecastUrl || null,
			emergency_enabled: emergencyEnabled,
			emergency_url: emergencyUrl || null,
			update_enabled: updateEnabled,
			update_url: updateUrl || null,
			updated_at: new Date().toISOString(),
		})
		.eq("id", id);

	if (error) {
		return {
			error: "Δεν ήταν δυνατή η αποθήκευση του μπάνερ.",
		};
	}

	revalidatePath("/");
	revalidatePath("/admin");
	revalidatePath("/admin/banner");
	revalidatePath(`/admin/banner/${id}/edit`);

	redirect("/admin/banner");
}

export async function deleteBannerAction(formData: FormData) {
	await requireAdmin();

	const id = String(formData.get("id") ?? "");

	if (!id) {
		throw new Error("Μη έγκυρο μπάνερ.");
	}

	const supabase = await createClient();

	const { error } = await supabase.from("weather_banner").delete().eq("id", id);

	if (error) {
		throw new Error(error.message);
	}

	revalidatePath("/");
	revalidatePath("/admin");
	revalidatePath("/admin/banner");

	redirect("/admin/banner");
}

export async function signOutAction() {
	const supabase = await createClient();

	await supabase.auth.signOut();

	redirect("/admin/login");
}
