import { ImageResponse } from "next/og";
import { loadOgFonts, OG_BLUE, OG_NAVY, OG_SIZE, photoDataUri } from "@/lib/og";
import { getPublishedPostBySlug } from "@/lib/posts";

export const alt = "GreeceWeather";
export const size = OG_SIZE;
export const contentType = "image/png";
export const revalidate = 300;

export default async function PostShareImage({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	const post = await getPublishedPostBySlug(slug);
	const [fonts, photo] = await Promise.all([loadOgFonts(), photoDataUri(post?.image_url)]);

	const tags = (post?.tags ?? []).slice(0, 3);

	return new ImageResponse(
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				position: "relative",
				background: `linear-gradient(135deg, ${OG_NAVY}, ${OG_BLUE})`,
				fontFamily: "OG",
				color: "#fff",
			}}
		>
			{photo && (
				// biome-ignore lint/performance/noImgElement: this is the image renderer, not a page
				<img
					src={photo}
					alt=""
					width={OG_SIZE.width}
					height={OG_SIZE.height}
					style={{ position: "absolute", left: 0, top: 0 }}
				/>
			)}

			<div
				style={{
					position: "absolute",
					left: 0,
					top: 0,
					width: "100%",
					height: "100%",
					display: "flex",
					background: photo
						? "linear-gradient(180deg, rgba(14,34,51,0.35) 0%, rgba(14,34,51,0.05) 40%, rgba(14,34,51,0.75) 100%)"
						: "transparent",
				}}
			/>

			<div
				style={{
					position: "relative",
					display: "flex",
					flexDirection: "column",
					justifyContent: "space-between",
					width: "100%",
					height: "100%",
					padding: "48px 56px",
				}}
			>
				<div style={{ display: "flex", alignItems: "center", fontSize: 28, letterSpacing: 3 }}>
					<div style={{ display: "flex", width: 14, height: 14, background: "#e5484d" }} />
					<div style={{ display: "flex", marginLeft: 14 }}>GREECEWEATHER.GR</div>
				</div>

				{/* The title is NOT drawn here: wherever this picture is shared (Instagram, Facebook,
				    WhatsApp) the title is written right under it, so it would appear twice. */}
				<div style={{ display: "flex", flexDirection: "column" }}>
					{!photo && (
						<div
							style={{
								display: "flex",
								marginBottom: 28,
								fontSize: 84,
								lineHeight: 1.1,
								textShadow: "0 2px 12px rgba(0,0,0,0.45)",
							}}
						>
							Ειδήσεις καιρού
						</div>
					)}

					{tags.length > 0 && (
						<div style={{ display: "flex" }}>
							{tags.map((tag) => (
								<div
									key={tag}
									style={{
										display: "flex",
										marginRight: 12,
										padding: "8px 20px",
										fontSize: 28,
										background: "rgba(255,255,255,0.2)",
										borderRadius: 999,
									}}
								>
									{tag}
								</div>
							))}
						</div>
					)}
				</div>
			</div>
		</div>,
		{ ...size, fonts },
	);
}
