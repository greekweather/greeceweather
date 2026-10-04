import type { MetadataRoute } from "next";

const siteUrl = "https://www.greeceweather.gr";

export default function robots(): MetadataRoute.Robots {
	return {
		rules: {
			userAgent: "*",
			allow: "/",
		},
		sitemap: `${siteUrl}/sitemap.xml`,
	};
}
