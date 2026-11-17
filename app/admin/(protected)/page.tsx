import { getPushStats } from "@/lib/push-stats";
import { createClient } from "@/lib/supabase/server";

export default async function AdminPage() {
	const supabase = await createClient();

	const push = await getPushStats();

	const [{ count: posts }, { count: publishedPosts }, { count: drafts }] = await Promise.all([
		supabase.from("posts").select("*", { count: "exact", head: true }),
		supabase.from("posts").select("*", { count: "exact", head: true }).eq("published", true),
		supabase.from("posts").select("*", { count: "exact", head: true }).eq("published", false),
	]);

	return (
		<>
			<header className="admin-page-header">
				<div>
					<p className="eyebrow">DASHBOARD</p>
					<h1>Πίνακας ελέγχου</h1>
					<p>Διαχείριση του περιεχομένου του GreeceWeather.</p>
				</div>
			</header>

			<section className="admin-dashboard-grid">
				<a className="admin-stat-card" href="/admin/posts">
					<span>Άρθρα</span>
					<strong>{posts ?? 0}</strong>
					<small>Όλα τα άρθρα</small>
				</a>

				<a className="admin-stat-card" href="/admin/posts?status=published">
					<span>Δημοσιευμένα</span>
					<strong>{publishedPosts ?? 0}</strong>
					<small>Δημοσιευμένα άρθρα</small>
				</a>

				<a className="admin-stat-card" href="/admin/posts?status=draft">
					<span>Πρόχειρα</span>
					<strong>{drafts ?? 0}</strong>
					<small>Μη δημοσιευμένα άρθρα</small>
				</a>
			</section>

			<section className="admin-section">
				<div className="admin-section-header">
					<div>
						<h2>Ειδοποιήσεις</h2>
						<p>
							{push.error
								? push.error
								: push.byTopic
									? "Πόσες συσκευές έχουν ενεργές τις ειδοποιήσεις, και για τι."
									: "Δεν έχει τρέξει το supabase/changes-2026-11-16.sql: όλες οι συσκευές παίρνουν τα πάντα."}
						</p>
					</div>
				</div>

				<div className="admin-dashboard-grid">
					<div className="admin-stat-card">
						<span>Συνολικά</span>
						<strong>{push.total}</strong>
						<small>Συσκευές με ειδοποιήσεις</small>
					</div>

					<div className="admin-stat-card">
						<span>Χάρτες</span>
						<strong>{push.maps}</strong>
						<small>Για νέο χάρτη</small>
					</div>

					<div className="admin-stat-card">
						<span>Άρθρα</span>
						<strong>{push.posts}</strong>
						<small>Για νέο άρθρο</small>
					</div>

					<div className="admin-stat-card">
						<span>Μπάνερ</span>
						<strong>{push.banner}</strong>
						<small>Για έκτακτο δελτίο</small>
					</div>
				</div>
			</section>

			<section className="admin-section">
				<div className="admin-section-header">
					<div>
						<h2>Γρήγορες ενέργειες</h2>
						<p>Συχνές ενέργειες διαχείρισης.</p>
					</div>
				</div>

				<div className="admin-actions-grid">
					<a className="admin-action-card" href="/admin/posts/new">
						<strong>Νέο άρθρο</strong>
						<span>Δημιούργησε ένα νέο άρθρο.</span>
					</a>

					<a className="admin-action-card" href="/admin/tags/new">
						<strong>Νέα ετικέτα</strong>
						<span>Πρόσθεσε μια νέα ετικέτα.</span>
					</a>

					<a className="admin-action-card" href="/admin/banner/new">
						<strong>Νέο μπάνερ</strong>
						<span>Δημιούργησε ένα νέο μπάνερ.</span>
					</a>

					<a className="admin-action-card" href="/admin/outlooks/new">
						<strong>Νέος χάρτης</strong>
						<span>Σχεδίασε έναν νέο χάρτη.</span>
					</a>
				</div>
			</section>
		</>
	);
}
