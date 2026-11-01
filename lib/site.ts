export const SITE_NAME = "GreeceWeather";

// Absolute address of the site, used wherever a full URL is required (feeds, sitemap, share
// cards, structured data). NEXT_PUBLIC_SITE_URL wins so a preview deployment points at itself.
export const SITE_URL = (
	process.env.NEXT_PUBLIC_SITE_URL || "https://www.greeceweather.gr"
).replace(/\/+$/, "");

export const SITE_DESCRIPTION =
	"Μετεωρολογικές αναλύσεις, προγνώσεις και άρθρα για τον καιρό στην Ελλάδα.";
