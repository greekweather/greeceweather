import { createBannerAction } from "@/app/actions";
import { BannerForm } from "@/components/admin/BannerForm";
import { createClient } from "@/lib/supabase/server";

export default async function NewBannerPage() {
	const supabase = await createClient();

	const { data: posts } = await supabase
		.from("posts")
		.select("id,title")
		.eq("published", true)
		.order("published_at", { ascending: false })
		.limit(100);

	return (
		<>
			<header className="admin-page-header">
				<div>
					<p className="eyebrow">ΠΕΡΙΕΧΟΜΕΝΟ</p>
					<h1>Νέο μπάνερ</h1>
					<p>Δημιούργησε ένα νέο μπάνερ για την ιστοσελίδα.</p>
				</div>

				<a className="button secondary" href="/admin/banner">
					← Επιστροφή
				</a>
			</header>

			<section className="admin-section">
				<BannerForm action={createBannerAction} posts={posts ?? []} />
			</section>
		</>
	);
}
