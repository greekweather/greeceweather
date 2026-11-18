import { ImageResponse } from "next/og";
import { OutlookGraphic } from "@/components/outlook/OutlookGraphic";
import { loadOgFonts, OG_NAVY, OG_SIZE } from "@/lib/og";
import { MAP_H, MAP_W } from "@/lib/outlook/geo";
import { getPublishedOutlookBySlug } from "@/lib/outlooks";

// The picture under a "new map" notification: just the map, centered on navy. The title and
// date are already written in the notification itself, so nothing is repeated here.
export const revalidate = 300;

const MAP_PX_W = Math.round((OG_SIZE.height * MAP_W) / MAP_H);
const MAP_LEFT = Math.round((OG_SIZE.width - MAP_PX_W) / 2);

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	const outlook = await getPublishedOutlookBySlug(slug);

	if (!outlook) return new Response("Not found", { status: 404 });

	const fonts = await loadOgFonts();
	const { renderToStaticMarkup } = await import("react-dom/server");
	const svg = renderToStaticMarkup(
		<OutlookGraphic
			title={outlook.title}
			data={outlook.map_data}
			issuedText=""
			legendPosition={outlook.legend_position}
			idPrefix="push"
			mapOnly
		/>,
	);
	const mapUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

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
			{/* biome-ignore lint/performance/noImgElement: this is the image renderer, not a page */}
			<img
				src={mapUri}
				alt=""
				width={MAP_PX_W}
				height={OG_SIZE.height}
				style={{ position: "absolute", left: MAP_LEFT, top: 0 }}
			/>

			<div
				style={{
					position: "absolute",
					left: 24,
					bottom: 20,
					display: "flex",
					fontSize: 20,
					letterSpacing: 3,
					color: "#9fc4e8",
				}}
			>
				GREECEWEATHER.GR
			</div>
		</div>,
		{ ...OG_SIZE, fonts },
	);
}
