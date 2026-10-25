import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

// ![alt](url "Caption") shows the title as a caption under the picture.
// Spans (not <figure>) so an image sitting inside a paragraph stays valid HTML.
export function Markdown({ content }: { content: string }) {
	return (
		<ReactMarkdown
			remarkPlugins={[remarkGfm]}
			rehypePlugins={[rehypeSanitize]}
			components={{
				img: ({ src, alt, title }) => {
					if (typeof src !== "string" || !src) return null;

					return (
						<span className="article-figure">
							{/* biome-ignore lint/performance/noImgElement: arbitrary remote URLs from markdown */}
							<img src={src} alt={alt ?? ""} loading="lazy" data-zoomable="" />
							{title && <span className="article-caption">{title}</span>}
						</span>
					);
				},
			}}
		>
			{content}
		</ReactMarkdown>
	);
}
