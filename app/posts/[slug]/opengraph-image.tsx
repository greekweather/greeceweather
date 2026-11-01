import { ImageResponse } from "next/og";
import { clip, loadOgFonts, OG_BLUE, OG_NAVY, OG_SIZE, photoDataUri, titleSize } from "@/lib/og";
import { getPublishedPostBySlug } from "@/lib/posts";

export const alt = "GreeceWeather";
export const size = OG_SIZE;
export const contentType = "image/png";
export const revalidate = 300;

export default async function PostShareImage({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	const post = await getPublishedPostBySlug(slug);
	const [fonts, photo] = await Promise.all([loadOgFonts(), photoDataUri(post?.image_url)]);

	const title = clip(post?.title ?? "GreeceWeather", 120);
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
						? "linear-gradient(180deg, rgba(14,34,51,0.25) 0%, rgba(14,34,51,0.55) 45%, rgba(14,34,51,0.94) 100%)"
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

				<div style={{ display: "flex", flexDirection: "column" }}>
					{tags.length > 0 && (
						<div style={{ display: "flex", marginBottom: 18 }}>
							{tags.map((tag) => (
								<div
									key={tag}
									style={{
										display: "flex",
										marginRight: 12,
										padding: "6px 16px",
										fontSize: 24,
										background: "rgba(255,255,255,0.18)",
										borderRadius: 999,
									}}
								>
									{tag}
								</div>
							))}
						</div>
					)}

					<div
						style={{
							display: "flex",
							fontSize: titleSize(title),
							lineHeight: 1.18,
							textShadow: "0 2px 12px rgba(0,0,0,0.45)",
						}}
					>
						{title}
					</div>
				</div>
			</div>
		</div>,
		{ ...size, fonts },
	);
}
