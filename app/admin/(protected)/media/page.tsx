import { MediaLibrary } from "@/components/admin/MediaLibrary";
import { Pagination } from "@/components/admin/Pagination";
import { listAllFiles } from "@/lib/media";
import { pageSizeFor } from "@/lib/page-size";
import { paginate } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";

export default async function MediaPage({
	searchParams,
}: {
	searchParams: Promise<{ page?: string; q?: string }>;
}) {
	const { page, q } = await searchParams;
	const query = (q ?? "").trim().slice(0, 80);
	const supabase = await createClient();

	const storageFiles = await listAllFiles(supabase);

	// the duplicate check looks at the whole library, the grid only at the search result
	const libraryIndex = storageFiles.slice(0, 2000).map((file) => ({
		name: file.name,
		url: supabase.storage.from("post-images").getPublicUrl(file.name).data.publicUrl,
	}));

	const needle = query.toLowerCase();
	const matching = needle
		? storageFiles.filter((file) => file.name.toLowerCase().includes(needle))
		: storageFiles;

	const pager = paginate(matching, page, await pageSizeFor("media"));

	const files = pager.items.map((file) => {
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

			<MediaLibrary
				key={`${pager.page}-${query}`}
				initialFiles={files}
				libraryIndex={libraryIndex}
				query={query}
			/>

			<Pagination
				{...pager}
				href={(n) =>
					`/admin/media?${new URLSearchParams({ ...(query ? { q: query } : {}), page: String(n) })}`
				}
			/>
		</section>
	);
}
