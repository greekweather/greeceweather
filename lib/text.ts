// Markdown to a short plain-text summary (feeds, structured data). Not a full parser: it only
// has to drop the markup of what this site's articles actually use.
export function plainText(markdown: string, max = 300): string {
	const text = markdown
		.replace(/```[\s\S]*?```/g, " ")
		.replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
		.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
		.replace(/<[^>]+>/g, " ")
		.replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, "")
		.replace(/[*_`~|]/g, "")
		.replace(/\s+/g, " ")
		.trim();

	if (text.length <= max) return text;

	const cut = text.slice(0, max);

	return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max * 0.6))}…`;
}

// XML text and attribute escaping for the feeds.
export function xmlEscape(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}
