import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
	title: "GreeceWeather",
	description: "Μετεωρολογικές αναλύσεις, προγνώσεις και άρθρα για τον καιρό στην Ελλάδα.",
	metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
	openGraph: {
		title: "GreeceWeather",
		description: "Μετεωρολογικές αναλύσεις, προγνώσεις και άρθρα για τον καιρό στην Ελλάδα.",
		url: "/",
		siteName: "GreeceWeather",
		locale: "el_GR",
		type: "website",
		images: [
			{
				url: "/images/supercell.jpg",
				width: 1200,
				height: 630,
				alt: "GreeceWeather",
			},
		],
	},
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang="el" data-scroll-behavior="smooth">
			<body>
				<Link className="skip-link" href="#content">
					Μετάβαση στο περιεχόμενο
				</Link>
				<header className="site-header">
					<div className="container header-inner">
						<Link className="brand" href="/" aria-label="Αρχική σελίδα GreeceWeather">
							GreeceWeather
						</Link>
						<nav className="site-nav" aria-label="Κύρια πλοήγηση">
							<Link href="/">Αρχική</Link>
							<Link href="/posts">Άρθρα</Link>
							<Link href="/maps">Χάρτες</Link>
						</nav>
					</div>
				</header>
				<main id="content">{children}</main>
				<footer className="site-footer">
					<div className="container footer-inner">
						<div>
							<strong>GreeceWeather</strong>
							<span> · {new Date().getFullYear()}</span>
						</div>
						<div>Μετεωρολογία και καιρός στην Ελλάδα</div>
					</div>
				</footer>
			</body>
		</html>
	);
}
