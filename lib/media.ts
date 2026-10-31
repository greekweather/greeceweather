import type { createClient } from "@/lib/supabase/server";

export type StorageFile = {
	name: string;
	id?: string | null;
	created_at?: string | null;
	updated_at?: string | null;
	metadata?: {
		size?: number;
		mimetype?: string;
	} | null;
};

// Every file of the image bucket, folders included, newest first.
export async function listAllFiles(
	supabase: Awaited<ReturnType<typeof createClient>>,
	path = "",
): Promise<StorageFile[]> {
	const { data, error } = await supabase.storage.from("post-images").list(path, {
		limit: 1000,
		sortBy: {
			column: "created_at",
			order: "desc",
		},
	});

	if (error) {
		throw new Error(error.message);
	}

	const files: StorageFile[] = [];

	for (const item of data ?? []) {
		const itemPath = path ? `${path}/${item.name}` : item.name;

		if (!item.id) {
			files.push(...(await listAllFiles(supabase, itemPath)));
		} else {
			files.push({ ...item, name: itemPath });
		}
	}

	return files;
}
