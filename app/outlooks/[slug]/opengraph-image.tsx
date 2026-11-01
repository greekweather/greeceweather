import { ImageResponse } from "next/og";
import { OutlookGraphic } from "@/components/outlook/OutlookGraphic";
import { clip, loadOgFonts, OG_NAVY, OG_SIZE } from "@/lib/og";
import { formatOutlookDate } from "@/lib/outlook/format";
import { MAP_H, MAP_W } from "@/lib/outlook/geo";
import { getPublishedOutlookBySlug } from "@/lib/outlooks";

export const alt = "Χάρτης GreeceWeather";
export const size = OG_SIZE;
export const contentType = "image/png";
export const revalidate = 300;

// The map is drawn full height in the middle of the card (it is wider than tall, so the sides
// stay navy), with the title in a box over the empty north-west corner of the Atlantic.
const MAP_PX_W = Math.round((OG_SIZE.height * MAP_W) / MAP_H);
const MAP_LEFT = Math.round((OG_SIZE.width - MAP_PX_W) / 2);

export default async function OutlookShareImage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const outlook = await getPublishedOutlookBySlug(slug);
	const fonts = await loadOgFonts();

	let mapUri: string | null = null;

	if (outlook) {
		// react-dom/server is loaded on demand: it is only needed to write the map out as SVG text
		const { renderToStaticMarkup } = await import("react-dom/server");
		const svg = renderToStaticMarkup(
			<OutlookGraphic
				title={outlook.title}
				data={outlook.map_data}
				issuedText=""
				legendPosition={outlook.legend_position}
				idPrefix="og"
				mapOnly
			/>,
		);

		mapUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
	}

	const title = clip(outlook?.title ?? "Χάρτες καιρού", 90);

	return new ImageResponse(
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				position: "relative",
				background: OG_NAVY,
				fontFamily: "OG",
				color: "#fff",
			}}
		>
			{mapUri && (
				// biome-ignore lint/performance/noImgElement: this is the image renderer, not a page
				<img
					src={mapUri}
					alt=""
					width={MAP_PX_W}
					height={OG_SIZE.height}
					style={{ position: "absolute", left: MAP_LEFT, top: 0 }}
				/>
			)}

			<div
				style={{
					position: "absolute",
					left: 28,
					top: 28,
					display: "flex",
					flexDirection: "column",
					maxWidth: 640,
					padding: "20px 26px",
					background: "rgba(14,34,51,0.92)",
					borderRadius: 10,
					borderLeft: "6px solid #e5484d",
				}}
			>
				<div style={{ display: "flex", fontSize: 20, letterSpacing: 3, color: "#9fc4e8" }}>
					GREECEWEATHER.GR · ΧΑΡΤΕΣ
				</div>

				<div
					style={{
						display: "flex",
						marginTop: 8,
						fontSize: title.length > 50 ? 32 : 40,
						lineHeight: 1.2,
					}}
				>
					{title}
				</div>

				{outlook && (
					<div style={{ display: "flex", marginTop: 10, fontSize: 22, color: "#d3e3f3" }}>
						{`Έκδοση: ${formatOutlookDate(outlook.issued_at)}`}
					</div>
				)}
			</div>

			<div
				style={{
					position: "absolute",
					right: 28,
					bottom: 28,
					display: "flex",
					padding: "8px 18px",
					fontSize: 22,
					letterSpacing: 2,
					color: "#c4161c",
					background: "#fff",
					border: "2px solid #c4161c",
					borderRadius: 6,
				}}
			>
				ΑΝΕΠΙΣΗΜΟ
			</div>
		</div>,
		{ ...size, fonts },
	);
}
