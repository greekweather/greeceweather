import { createClient } from "@/lib/supabase/server";

type WeatherBannerData = {
	forecast_enabled: boolean;
	forecast_url: string | null;
	emergency_enabled: boolean;
	emergency_url: string | null;
	update_enabled: boolean;
	update_url: string | null;
};

export async function WeatherBanner() {
	const supabase = await createClient();

	const { data } = await supabase
		.from("weather_banner")
		.select(
			"forecast_enabled,forecast_url,emergency_enabled,emergency_url,update_enabled,update_url",
		)
		.order("updated_at", { ascending: false })
		.limit(1)
		.maybeSingle<WeatherBannerData>();

	if (!data) {
		return null;
	}

	const items = [
		data.forecast_enabled && data.forecast_url
			? {
					url: data.forecast_url,
					label: "ΠΡΟΓΝΩΣΗ",
					className: "weather-banner-forecast",
				}
			: null,
		data.emergency_enabled && data.emergency_url
			? {
					url: data.emergency_url,
					label: "ΕΚΤΑΚΤΟ ΔΕΛΤΙΟ",
					className: "weather-banner-emergency",
				}
			: null,
		data.update_enabled && data.update_url
			? {
					url: data.update_url,
					label: "ΕΠΙΚΑΙΡΟΠΟΙΗΣΗ ΔΕΛΤΙΟΥ",
					className: "weather-banner-update",
				}
			: null,
	].filter((item) => item !== null);

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
