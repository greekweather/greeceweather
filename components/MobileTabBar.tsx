"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { icons } from "@/components/TabIcons";
import { useIsAdmin } from "@/components/useIsAdmin";

type Tab = { href: string; label: string; icon: keyof typeof icons; exact?: boolean };

const PUBLIC_TABS: Tab[] = [
	{ href: "/", label: "Αρχική", icon: "home", exact: true },
	{ href: "/posts", label: "Άρθρα", icon: "articles" },
	{ href: "/outlooks", label: "Χάρτες", icon: "maps" },
];

// Bottom tab bar for phones (public site). The admin pages have their own bar.
export function MobileTabBar() {
	const pathname = usePathname();
	const admin = useIsAdmin();

	if (pathname.startsWith("/admin")) return null;

	const tabs = admin
		? [...PUBLIC_TABS, { href: "/admin", label: "Διαχείριση", icon: "admin" as const }]
		: PUBLIC_TABS;

	return (
		<nav className="tabbar" aria-label="Κύρια πλοήγηση">
			{tabs.map((tab) => {
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
		</nav>
	);
}
