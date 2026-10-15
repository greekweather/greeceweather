import { isSafeBannerUrl } from "@/lib/banner";
import { createPublicClient } from "@/lib/supabase/public";

type WeatherBannerData = {
	forecast_enabled: boolean;
	forecast_url: string | null;
	emergency_enabled: boolean;
	emergency_url: string | null;
	update_enabled: boolean;
	update_url: string | null;
};

type BannerItem = {
	url: string;
	label: string;
	className: string;
};

// Returns the URL only when the option is on and the link is a safe https:// URL.
function pickUrl(enabled: boolean, url: string | null): string | null {
	return enabled && url && isSafeBannerUrl(url) ? url : null;
}

export async function WeatherBanner() {
	const supabase = await createPublicClient();
	const now = new Date().toISOString();

	const { data } = await supabase
		.from("weather_banner")
		.select(
			"forecast_enabled,forecast_url,emergency_enabled,emergency_url,update_enabled,update_url",
		)
		.or(`starts_at.is.null,starts_at.lte.${now}`)
		.or(`ends_at.is.null,ends_at.gt.${now}`)
		.order("updated_at", { ascending: false })
		.limit(1)
		.maybeSingle<WeatherBannerData>();

	if (!data) {
		return null;
	}

	const forecastUrl = pickUrl(data.forecast_enabled, data.forecast_url);
	const emergencyUrl = pickUrl(data.emergency_enabled, data.emergency_url);
	const updateUrl = pickUrl(data.update_enabled, data.update_url);

	const items = [
		forecastUrl
			? { url: forecastUrl, label: "ΠΡΟΓΝΩΣΗ", className: "weather-banner-forecast" }
			: null,
		emergencyUrl
			? { url: emergencyUrl, label: "ΕΚΤΑΚΤΟ ΔΕΛΤΙΟ", className: "weather-banner-emergency" }
			: null,
		updateUrl
			? {
					url: updateUrl,
					label: "ΕΠΙΚΑΙΡΟΠΟΙΗΣΗ ΔΕΛΤΙΟΥ",
					className: "weather-banner-update",
				}
			: null,
	].filter((item): item is BannerItem => item !== null);

	if (items.length === 0) {
		return null;
	}

	return (
		<section className="weather-banner" aria-labelledby="weather-banner-title">
			<div className="weather-banner-inner">
				<h2 id="weather-banner-title" className="weather-banner-title">
					Ισχυρή κακοκαιρία σε εξέλιξη
				</h2>

				<div className="weather-banner-items">
					{items.map((item) => (
						<a
							key={item.label}
							href={item.url}
							rel="noopener noreferrer"
							className={`weather-banner-item ${item.className}`}
						>
							<span>{item.label}</span>
							<span className="weather-banner-arrow" aria-hidden="true">
								→
							</span>
						</a>
					))}
				</div>
			</div>
		</section>
	);
}
