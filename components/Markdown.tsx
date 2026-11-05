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

const EMBED_HOSTS = new Set(["www.facebook.com", "web.facebook.com"]);
const EMBED_PATHS = new Set(["/plugins/video.php", "/plugins/post.php"]);
const IFRAME_TAG = /<iframe\b[^>]*>\s*<\/iframe>/gi;

type Embed = { src: string; width: number; height: number };

function attr(tag: string, name: string): string | null {
	const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"));

	return match ? (match[1] ?? match[2] ?? "") : null;
}

// Only a pasted Facebook video/post plugin iframe is accepted; the address is rebuilt from
// known parameters so nothing else can ride along. Any other iframe stays plain text.
function parseEmbed(tag: string): Embed | null {
	const raw = attr(tag, "src");

	if (!raw) return null;

	let url: URL;

	try {
		url = new URL(raw.replace(/&amp;/g, "&"));
	} catch {
		return null;
	}

	if (url.protocol !== "https:" || !EMBED_HOSTS.has(url.hostname)) return null;
	if (!EMBED_PATHS.has(url.pathname)) return null;

	const href = url.searchParams.get("href") ?? "";

	if (!/^https:\/\/(www|web|m)\.facebook\.com\//i.test(href)) return null;

	const clamp = (value: string | null, fallback: number, min: number, max: number) => {
		const number = Number(value);

		return Number.isFinite(number) && number > 0
			? Math.min(max, Math.max(min, Math.round(number)))
			: fallback;
	};

	const width = clamp(url.searchParams.get("width") ?? attr(tag, "width"), 342, 180, 560);
	// Two different heights, as Facebook's snippet has them: the one in the address is the video
	// player's, the iframe's own is taller to leave room for the post text under the video.
	const playerHeight = clamp(url.searchParams.get("height"), 476, 100, 900);
	const EXTRA_SPACE = 40;
	const height = clamp(attr(tag, "height"), playerHeight + 300, playerHeight, 1600) + EXTRA_SPACE;
	const src = new URL(`https://www.facebook.com${url.pathname}`);

	src.searchParams.set("href", href);
	src.searchParams.set(
		"show_text",
		url.searchParams.get("show_text") === "true" ? "true" : "false",
	);
	src.searchParams.set("width", String(width));
	src.searchParams.set("height", String(playerHeight));

	return { src: src.toString(), width, height };
}

type Piece = { type: "md"; text: string } | { type: "embed"; embed: Embed };

function fencedRanges(content: string): [number, number][] {
	const ranges: [number, number][] = [];
	let open: number | null = null;
	let offset = 0;

	for (const line of content.split("\n")) {
		if (/^\s{0,3}(```|~~~)/.test(line)) {
			if (open === null) {
				open = offset;
			} else {
				ranges.push([open, offset + line.length]);
				open = null;
			}
		}

		offset += line.length + 1;
	}

	if (open !== null) ranges.push([open, content.length]);

	return ranges;
}

function splitEmbeds(content: string): Piece[] {
	if (!/<iframe/i.test(content)) return [{ type: "md", text: content }];

	const fenced = fencedRanges(content);
	const pieces: Piece[] = [];
	let last = 0;

	for (const match of content.matchAll(IFRAME_TAG)) {
		const index = match.index ?? 0;

		if (fenced.some(([from, to]) => index >= from && index < to)) continue;

		const embed = parseEmbed(match[0]);

		if (!embed) continue;

		pieces.push({ type: "md", text: content.slice(last, index) });
		pieces.push({ type: "embed", embed });
		last = index + match[0].length;
	}

	pieces.push({ type: "md", text: content.slice(last) });

	return pieces.filter((piece) => piece.type === "embed" || piece.text.trim() !== "");
}

export function Markdown({ content }: { content: string }) {
	const pieces = splitEmbeds(content);

	if (pieces.length === 1 && pieces[0].type === "md") return <MarkdownBlock content={content} />;

	return (
		<>
			{pieces.map((piece, index) =>
				piece.type === "md" ? (
					// biome-ignore lint/suspicious/noArrayIndexKey: static split of one string
					<MarkdownBlock key={index} content={piece.text} />
				) : (
					// biome-ignore lint/suspicious/noArrayIndexKey: static split of one string
					<div className="embed-wrap" key={index}>
						<iframe
							className="embed-frame"
							src={piece.embed.src}
							title="Ενσωματωμένο βίντεο Facebook"
							width={piece.embed.width}
							height={piece.embed.height}
							style={{ maxWidth: "100%" }}
							loading="lazy"
							allowFullScreen
							allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
							sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
							referrerPolicy="origin-when-cross-origin"
						/>
					</div>
				),
			)}
		</>
	);
}

// ![alt](url "Caption") shows the title as a caption under the picture.
// Spans (not <figure>) so an image sitting inside a paragraph stays valid HTML.
function MarkdownBlock({ content }: { content: string }) {
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
