"use client";

import { useState } from "react";
import { Markdown } from "@/components/Markdown";

type PreviewProps = {
	title: string;
	description: string;
	content: string;
	imageUrl: string;
	imageAlt: string;
	imageCaption: string;
	tags: string[];
};

type View = "card" | "article";

// Shows the post the way visitors will see it. Plain <img> on purpose: the picture may be
// a URL that next/image has not been told about, and this is only an editor preview.
export function PostPreview({
	title,
	description,
	content,
	imageUrl,
	imageAlt,
	imageCaption,
	tags,
}: PreviewProps) {
	const [view, setView] = useState<View>("article");

	return (
		<div className="post-preview">
			<div className="post-preview-tabs" role="tablist" aria-label="Τύπος προεπισκόπησης">
				<button
					type="button"
					role="tab"
					aria-selected={view === "article"}
					className={view === "article" ? "active" : ""}
					onClick={() => setView("article")}
				>
					Άρθρο
				</button>
				<button
					type="button"
					role="tab"
					aria-selected={view === "card"}
					className={view === "card" ? "active" : ""}
					onClick={() => setView("card")}
				>
					Κάρτα στη λίστα
				</button>
			</div>

			{view === "card" ? (
				<div className="post-preview-card">
					<article className="post-card">
						<div className="post-image-link">
							{imageUrl ? (
								// biome-ignore lint/performance/noImgElement: editor preview of an arbitrary URL
								<img className="post-image" src={imageUrl} alt="" />
							) : (
								<div className="post-image post-image-placeholder" aria-hidden="true">
									<span>Χωρίς εικόνα</span>
								</div>
							)}
						</div>

						<div className="post-card-body">
							<h3>{title || "(χωρίς τίτλο)"}</h3>
							<p>{description}</p>

							<div className="post-card-footer">
								<div className="post-tags">
									{tags.map((tag) => (
										<span className="post-tag" key={tag}>
											{tag}
										</span>
									))}
								</div>
							</div>
						</div>
					</article>
				</div>
			) : (
				<article className="article post-preview-article">
					<div className="container article-container">
						<header className="article-header">
							<h1>{title || "(χωρίς τίτλο)"}</h1>
							{description && <p className="article-lead">{description}</p>}
						</header>

						{imageUrl && (
							<figure className="article-hero">
								{/* biome-ignore lint/performance/noImgElement: editor preview of an arbitrary URL */}
								<img src={imageUrl} alt={imageAlt || title} />
								{imageCaption && <figcaption>{imageCaption}</figcaption>}
							</figure>
						)}

						<div className="article-body">
							<Markdown content={content} />
						</div>

						{tags.length > 0 && (
							<footer className="article-footer">
								<span>Ετικέτες:</span>
								{tags.map((tag) => (
									<span key={tag} className="post-tag">
										{tag}
									</span>
								))}
							</footer>
						)}
					</div>
				</article>
			)}
		</div>
	);
}
