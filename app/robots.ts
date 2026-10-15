import type { MetadataRoute } from "next";

const siteUrl = "https://www.greeceweather.gr";

export default function robots(): MetadataRoute.Robots {
	return {
		rules: {
			userAgent: "*",
			allow: "/",
			disallow: ["/admin", "/api/"],
		},
		sitemap: `${siteUrl}/sitemap.xml`,
	};
}
