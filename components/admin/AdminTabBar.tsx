"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { icons } from "@/components/TabIcons";

type Tab = { href: string; label: string; icon: keyof typeof icons; exact?: boolean };

const TABS: Tab[] = [
	{ href: "/admin", label: "Πίνακας", icon: "dashboard", exact: true },
	{ href: "/admin/posts", label: "Άρθρα", icon: "articles" },
	{ href: "/admin/outlooks", label: "Χάρτες", icon: "maps" },
	{ href: "/admin/banner", label: "Μπάνερ", icon: "banner" },
];

// Bottom tab bar for the admin on phones. "Περισσότερα" opens a sheet with the rest
// (tags, media, public site, sign out), passed in as children from the server layout.
export function AdminTabBar({ children }: { children: React.ReactNode }) {
	const pathname = usePathname();
	const [open, setOpen] = useState(false);

	// biome-ignore lint/correctness/useExhaustiveDependencies: close the sheet after navigating
	useEffect(() => {
		setOpen(false);
	}, [pathname]);

	const inMore = !TABS.some((tab) =>
		tab.exact ? pathname === tab.href : pathname.startsWith(tab.href),
	);

	return (
		<>
			{open && (
				<>
					<button
						type="button"
						className="admin-more-backdrop"
						aria-label="Κλείσιμο"
						onClick={() => setOpen(false)}
					/>
					<div className="admin-more-sheet" id="admin-more">
						{children}
					</div>
				</>
			)}

			<nav className="tabbar tabbar-admin" aria-label="Πλοήγηση διαχείρισης">
				{TABS.map((tab) => {
					const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);

					return (
						<Link
							key={tab.href}
							href={tab.href}
							className={`tabbar-item ${active ? "active" : ""}`}
							aria-current={active ? "page" : undefined}
						>
							{icons[tab.icon]}
							<span>{tab.label}</span>
						</Link>
					);
				})}

				<button
					type="button"
					className={`tabbar-item ${open || inMore ? "active" : ""}`}
					aria-expanded={open}
					aria-controls="admin-more"
					onClick={() => setOpen((value) => !value)}
				>
					{icons.more}
					<span>Περισσότερα</span>
				</button>
			</nav>
		</>
	);
}
