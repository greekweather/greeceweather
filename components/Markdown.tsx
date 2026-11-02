import type { Element, ElementContent } from "hast";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { LinkCard } from "@/components/LinkCard";

function textOf(node: ElementContent): string {
	if (node.type === "text") return node.value;

	return node.type === "element" ? node.children.map(textOf).join("") : "";
}

// The link of a paragraph that holds nothing but one link: [text](https://…) or a bare
// https://… on its own line. Anything with other text around the link stays a normal paragraph.
function soleLink(node: Element | undefined): { href: string; label: string } | null {
	const parts = (node?.children ?? []).filter(
		(child) => !(child.type === "text" && child.value.trim() === ""),
	);
	const only = parts[0];

	if (parts.length !== 1 || only.type !== "element" || only.tagName !== "a") return null;

	const href = only.properties?.href;

	if (typeof href !== "string" || !/^https?:\/\//i.test(href)) return null;

	return { href, label: textOf(only).trim() };
}

// ![alt](url "Caption") shows the title as a caption under the picture.
// Spans (not <figure>) so an image sitting inside a paragraph stays valid HTML.
export function Markdown({ content }: { content: string }) {
	return (
		<ReactMarkdown
			remarkPlugins={[remarkGfm]}
			rehypePlugins={[rehypeSanitize]}
			components={{
				p: ({ node, children }) => {
					const link = soleLink(node);

					// a <div>, not a <p>: the card is a block
					return link ? (
						<div className="link-card-wrap">
							<LinkCard href={link.href} label={link.label} />
						</div>
					) : (
						<p>{children}</p>
					);
				},
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
