import { MediaLibrary } from "@/components/admin/MediaLibrary";
import { createClient } from "@/lib/supabase/server";

type StorageFile = {
	name: string;
	id?: string | null;
	created_at?: string | null;
	updated_at?: string | null;
	metadata?: {
		size?: number;
		mimetype?: string;
	} | null;
};

async function listAllFiles(
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

		// Supabase folders don't have an id.
		if (!item.id) {
			const nestedFiles = await listAllFiles(supabase, itemPath);
			files.push(...nestedFiles);
		} else {
			files.push({
				...item,
				name: itemPath,
			});
		}
	}

	return files;
}

export default async function MediaPage() {
	const supabase = await createClient();

	const storageFiles = await listAllFiles(supabase);

	const files = storageFiles.map((file) => {
		const { data: publicUrl } = supabase.storage.from("post-images").getPublicUrl(file.name);

		return {
			name: file.name,
			url: publicUrl.publicUrl,
			created_at: file.created_at ?? null,
			size: file.metadata?.size ?? null,
			content_type: file.metadata?.mimetype ?? null,
		};
	});

	return (
		<section className="section">
			<div className="admin-page-header">
				<div>
					<p className="eyebrow">ΠΟΛΥΜΕΣΑ</p>
					<h1>Πολύμεσα</h1>
					<p>Διαχείριση των εικόνων που χρησιμοποιούνται στα άρθρα.</p>
				</div>
			</div>

			<MediaLibrary initialFiles={files} />
		</section>
	);
}
