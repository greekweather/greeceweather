import Link from "next/link";
import { signOutAction } from "@/app/actions";
import { requireAdmin } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
	const user = await requireAdmin();

	return (
		<div className="admin-shell">
			<aside className="admin-sidebar">
				<div className="admin-brand">
					<p className="eyebrow">ADMIN</p>
					<strong>GreeceWeather</strong>
				</div>

				<nav className="admin-sidebar-nav" aria-label="Admin navigation">
					<Link href="/admin">Πίνακας Ελέγχου</Link>

					<div className="admin-nav-group">
						<span>Περιεχόμενο</span>
						<Link href="/admin/posts">Άρθρα</Link>
						<Link href="/admin/tags">Ετικέτες</Link>
						<Link href="/admin/media">Πολυμέσα</Link>
					</div>
				</nav>

				<div className="admin-sidebar-footer">
					<span>{user.email}</span>

					<Link href="/">← Δημόσια σελίδα</Link>

					<form action={signOutAction}>
						<button type="submit">Αποσύνδεση</button>
					</form>
				</div>
			</aside>

			<main className="admin-main">{children}</main>
		</div>
	);
}
