import { MediaLibrary } from "@/components/admin/MediaLibrary";
import { Pagination } from "@/components/admin/Pagination";
import { listAllFiles } from "@/lib/media";
import { paginate } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";

export default async function MediaPage({
	searchParams,
}: {
	searchParams: Promise<{ page?: string }>;
}) {
	const { page } = await searchParams;
	const supabase = await createClient();

	const storageFiles = await listAllFiles(supabase);

	const pager = paginate(storageFiles, page);

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

			<MediaLibrary key={pager.page} initialFiles={files} />

			<Pagination {...pager} href={(n) => `/admin/media?page=${n}`} />
		</section>
	);
}
