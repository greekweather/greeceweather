import type { MetadataRoute } from "next";

// Makes the site installable ("Add to Home screen") so it opens like an app, without the
// browser bars. Logging in works as usual: it is the same site and the same session cookie.
export default function manifest(): MetadataRoute.Manifest {
	return {
		id: "/",
		name: "GreeceWeather",
		short_name: "GreeceWeather",
		description: "Μετεωρολογικές αναλύσεις, προγνώσεις και άρθρα για τον καιρό στην Ελλάδα.",
		lang: "el",
		start_url: "/",
		scope: "/",
		display: "standalone",
		background_color: "#0e2233",
		theme_color: "#0e2233",
		icons: [
			{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
			{ src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
			{
				src: "/icons/maskable-512.png",
				sizes: "512x512",
				type: "image/png",
				purpose: "maskable",
			},
		],
		shortcuts: [
			{ name: "Διαχείριση", short_name: "Admin", url: "/admin" },
			{ name: "Άρθρα", url: "/posts" },
			{ name: "Χάρτες", url: "/outlooks" },
		],
	};
}
