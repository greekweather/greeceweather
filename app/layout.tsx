import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, Noto_Serif } from "next/font/google";
import "./globals.css";
import Image from "next/image";
import Link from "next/link";
import { AdminLink } from "@/components/AdminLink";
import { InstallApp } from "@/components/InstallApp";
import { PwaRegister } from "@/components/PwaRegister";
import { RefreshOnNavigate } from "@/components/RefreshOnNavigate";
import { ThemeToggle } from "@/components/ThemeToggle";
import { WeatherBanner } from "@/components/WeatherBanner";

const notoSerif = Noto_Serif({
	subsets: ["greek", "latin"],
	variable: "--font-noto-serif",
	display: "swap",
});

const plexSans = IBM_Plex_Sans({
	subsets: ["greek", "latin"],
	weight: ["400", "500", "600", "700"],
	variable: "--font-plex-sans",
	display: "swap",
});

export const metadata: Metadata = {
	title: "GreeceWeather",
	description: "Μετεωρολογικές αναλύσεις, προγνώσεις και άρθρα για τον καιρό στην Ελλάδα.",
	icons: { apple: "/icons/apple-touch-icon.png" },
	appleWebApp: { capable: true, title: "GreeceWeather", statusBarStyle: "default" },
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

export const viewport: Viewport = {
	colorScheme: "light dark",
	themeColor: "#0e2233",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	return (
		<html
			lang="el"
			data-scroll-behavior="smooth"
			className={`${notoSerif.variable} ${plexSans.variable}`}
			suppressHydrationWarning
		>
			<head>{typeof window === "undefined" ? <script src="/theme-init.js" /> : null}</head>
			<body>
				<PwaRegister />
				<RefreshOnNavigate />
				<Link className="skip-link" href="#content">
					Μετάβαση στο περιεχόμενο
				</Link>
				<header className="site-header">
					<div className="container header-inner">
						<Link className="brand" href="/" aria-label="Αρχική σελίδα GreeceWeather">
							<Image src="/icon.svg" alt="" width={32} height={32} />
							GreeceWeather
						</Link>
						<div className="header-right">
							<nav className="site-nav" aria-label="Κύρια πλοήγηση">
								<Link href="/">Αρχική</Link>
								<Link href="/posts">Άρθρα</Link>
								<Link href="/outlooks">Χάρτες</Link>
								<AdminLink />
							</nav>
							<ThemeToggle />
						</div>
					</div>
				</header>

				<WeatherBanner />

				<main id="content">{children}</main>
				<footer className="site-footer">
					<div className="container footer-inner">
						<div>
							<strong>GreeceWeather</strong>
							<span> · {new Date().getFullYear()}</span>
						</div>
						<div>Μετεωρολογία και καιρός στην Ελλάδα</div>
						<InstallApp />
					</div>
				</footer>
			</body>
		</html>
	);
}
