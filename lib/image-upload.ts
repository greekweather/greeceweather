import { createClient } from "@/lib/supabase/client";

const IMAGE_BUCKET = "post-images";

const MAX_INPUT_BYTES = 8 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 800 * 1024;
const IMAGE_NAME = /\.(webp|jpe?g|png|gif|avif)$/i;

export type StoredImage = {
	path: string;
	url: string;
	createdAt: string | null;
	size: number | null;
};

async function compressImage(file: File): Promise<File> {
	if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
		throw new Error("Χρησιμοποίησε JPG, PNG ή WebP.");
	if (file.size > MAX_INPUT_BYTES) throw new Error("Η αρχική εικόνα πρέπει να είναι έως 8 MB.");

	const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(
		async () => {
			const url = URL.createObjectURL(file);
			const img = new Image();
			img.src = url;
			await img.decode();
			URL.revokeObjectURL(url);
			return img as unknown as ImageBitmap;
		},
	);

	const width = "width" in bitmap ? bitmap.width : 1600;
	const height = "height" in bitmap ? bitmap.height : 900;
	const scale = Math.min(1, 1800 / Math.max(width, height));
	const canvas = document.createElement("canvas");
	canvas.width = Math.max(1, Math.round(width * scale));
	canvas.height = Math.max(1, Math.round(height * scale));
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("Ο browser δεν υποστηρίζει canvas.");
	ctx.drawImage(bitmap as CanvasImageSource, 0, 0, canvas.width, canvas.height);

	let quality = 0.84;
	let blob: Blob | null = null;
	while (quality >= 0.5) {
		blob = await new Promise<Blob | null>((resolve) =>
			canvas.toBlob(resolve, "image/webp", quality),
		);
		if (blob && blob.size <= MAX_OUTPUT_BYTES) break;
		quality -= 0.08;
	}
	if (!blob) throw new Error("Δεν ήταν δυνατή η συμπίεση της εικόνας.");
	if (blob.size > MAX_OUTPUT_BYTES)
		throw new Error("Η εικόνα παραμένει πολύ μεγάλη μετά τη συμπίεση.");
	return new File([blob], `${crypto.randomUUID()}.webp`, { type: "image/webp" });
}

// Compresses the file, uploads it to the bucket and returns it as a stored image.
export async function uploadImage(file: File): Promise<StoredImage> {
	const compressed = await compressImage(file);
	const supabase = createClient();

	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) throw new Error("Η συνεδρία έληξε. Κάνε ξανά σύνδεση.");

	const path = `${user.id}/${compressed.name}`;
	const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, compressed, {
		cacheControl: "31536000",
		contentType: "image/webp",
		upsert: false,
	});
	if (error) throw error;

	const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path);
	return {
		path,
		url: data.publicUrl,
		createdAt: new Date().toISOString(),
		size: compressed.size,
	};
}

async function walk(prefix: string, depth: number): Promise<StoredImage[]> {
	const supabase = createClient();
	const { data, error } = await supabase.storage.from(IMAGE_BUCKET).list(prefix, {
		limit: 1000,
		sortBy: { column: "created_at", order: "desc" },
	});
	if (error) throw error;

	const found: StoredImage[] = [];

	for (const item of data ?? []) {
		const path = prefix ? `${prefix}/${item.name}` : item.name;
		if (!item.id) {
			if (depth > 0) found.push(...(await walk(path, depth - 1)));
			continue;
		}

		if (!IMAGE_NAME.test(item.name)) continue;

		found.push({
			path,
			url: supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl,
			createdAt: item.created_at ?? null,
			size: item.metadata?.size ?? null,
		});
	}

	return found;
}

// Every image in the bucket, newest first.
export async function listImages(): Promise<StoredImage[]> {
	const images = await walk("", 2);
	return images.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}
