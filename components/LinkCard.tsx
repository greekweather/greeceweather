"use client";

import { useEffect, useState } from "react";

type Preview = {
	url: string;
	domain: string;
	title: string | null;
	description: string | null;
	image: string | null;
	siteName: string | null;
};

type Result = { preview: Preview } | { preview: null };

// Same list as the server's: these sites refuse bots, so no request is made for them.
const NO_PREVIEW_HOSTS =
	/(^|\.)(facebook\.com|fb\.com|fb\.me|fb\.watch|instagram\.com|threads\.net|linkedin\.com|x\.com|twitter\.com|t\.co)$/i;

// Results of this visit: a link that appears twice, or comes back after navigating, is asked once.
const results = new Map<string, Result>();

function hostOf(href: string): string {
	try {
		return new URL(href).hostname.replace(/^www\./, "");
	} catch {
		return href;
	}
}

function platformName(host: string): string | null {
	if (/facebook\.com|fb\.com|fb\.me|fb\.watch/i.test(host)) return "Facebook";
	if (/instagram\.com/i.test(host)) return "Instagram";

	return null;
}

/**
 * A link on its own line in an article, shown as a card: picture, title, description, site.
 *   loading   the card shows the address and is already clickable
 *   no data   a normal link; for Facebook and similar sites (they send bots to a login page)
 *             a plain card with the site name
 */
export function LinkCard({ href, label }: { href: string; label: string }) {
	const host = hostOf(href);
	const plain = NO_PREVIEW_HOSTS.test(host);
	const [result, setResult] = useState<Result | null>(() => results.get(href) ?? null);

	useEffect(() => {
		if (plain || results.has(href)) {
			setResult(results.get(href) ?? null);
			return;
		}

		const controller = new AbortController();

		fetch(`/api/link-preview?url=${encodeURIComponent(href)}`, { signal: controller.signal })
			.then((response) => (response.ok ? response.json() : null))
			.then((body) => {
				const next: Result =
					body?.ok && body.preview ? { preview: body.preview } : { preview: null };

				results.set(href, next);
				setResult(next);
			})
			.catch((error) => {
				if (error?.name !== "AbortError") setResult({ preview: null });
			});

		return () => controller.abort();
	}, [href, plain]);

	const readable = label && label !== href ? label : "";

	if (plain) {
		const name = platformName(host);

		return (
			<a
				className="link-card link-card-plain"
				href={href}
				target="_blank"
				rel="noopener noreferrer nofollow"
			>
				<span className="link-card-body">
					<span className="link-card-domain">{host}</span>
					<span className="link-card-title">
						{readable || (name ? `Άνοιγμα στο ${name}` : "Άνοιγμα συνδέσμου")}
					</span>
				</span>
			</a>
		);
	}

	if (result && !result.preview) {
		return (
			<a href={href} target="_blank" rel="noopener noreferrer nofollow">
				{readable || href}
			</a>
		);
	}

	const preview = result?.preview ?? null;

	return (
		<a
			className={`link-card ${preview ? "" : "link-card-loading"}`}
			href={href}
			target="_blank"
			rel="noopener noreferrer nofollow"
			aria-busy={!preview}
		>
			{preview?.image && (
				// biome-ignore lint/performance/noImgElement: remote picture of any site
				<img
					className="link-card-image"
					src={preview.image}
					alt=""
					loading="lazy"
					referrerPolicy="no-referrer"
					onError={(event) => event.currentTarget.remove()}
				/>
			)}

			<span className="link-card-body">
				<span className="link-card-domain">{preview?.siteName || host}</span>
				<span className="link-card-title">
					{preview?.title || readable || (preview ? preview.domain : href)}
				</span>
				{preview?.description && (
					<span className="link-card-description">{preview.description}</span>
				)}
			</span>
		</a>
	);
}
